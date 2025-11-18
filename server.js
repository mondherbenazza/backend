require("dotenv").config()
const jwt = require("jsonwebtoken");
const marked = require("marked");
const sanitiseHTML= require('sanitize-html');
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const rateLimit = require('express-rate-limit');
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const postgres = require("postgres");
const crypto = require("crypto");

// Build a robust connection that enables SSL automatically for remote DBs
const dbUrl = process.env.DATABASE_URL || "postgresql://localhost/ourapp";
let sslOption = false;
try {
	const parsed = new URL(dbUrl);
	const host = (parsed.hostname || "").toLowerCase();
	const isLocal = host === "localhost" || host === "127.0.0.1";
	const sslMode = parsed.searchParams.get("sslmode");
	if (sslMode === "require") {
		sslOption = "require";
	} else if (!isLocal) {
		// Force SSL for non-local databases if not explicitly set
		sslOption = "require";
	}
} catch (e) {
	// Fallback to previous behavior if URL parsing fails
	sslOption = process.env.NODE_ENV === "production" ? "require" : false;
}

const sql = postgres(dbUrl, { ssl: sslOption });

// Multer in-memory storage for forwarding uploads to Supabase Storage
// Add a file size limit to avoid exhausting memory (10MB default)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || String(10 * 1024 * 1024), 10) } });

// Supabase client for Storage uploads
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "uploads"; // set your bucket name via env
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Image token secret for authenticated image access (Netflix-style)
const IMAGE_TOKEN_SECRET = process.env.IMAGE_TOKEN_SECRET || process.env.JWTSECRET || 'default-secret-change-in-production';
const IMAGE_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour expiry

// Generate secure token for image access
function generateImageToken(imageUrl, postId) {
    const payload = {
        url: imageUrl,
        postId: postId,
        exp: Date.now() + IMAGE_TOKEN_EXPIRY,
        iat: Date.now()
    };
    const token = crypto.createHmac('sha256', IMAGE_TOKEN_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
    // Use base64 encoding and replace URL-unsafe characters
    return Buffer.from(JSON.stringify({ ...payload, sig: token }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Verify image token
function verifyImageToken(token) {
    try {
        // Restore base64 padding and convert back
        let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        while (base64.length % 4) {
            base64 += '=';
        }
        const decoded = JSON.parse(Buffer.from(base64, 'base64').toString());
        const { sig, ...payload } = decoded;
        const expectedSig = crypto.createHmac('sha256', IMAGE_TOKEN_SECRET)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        if (sig !== expectedSig) {
            return null;
        }
        
        if (payload.exp < Date.now()) {
            return null; // Token expired
        }
        
        return payload;
    } catch (e) {
        return null;
    }
}

// Helper function to protect image URLs in posts (Netflix-style)
function protectPostImages(posts) {
    if (!Array.isArray(posts)) {
        posts = [posts];
    }
    return posts.map(post => {
        if (post.imageurl) {
            const token = generateImageToken(post.imageurl, post.id);
            return {
                ...post,
                imageurl: `/api/media/${token}`,
                originalImageUrl: post.imageurl // Keep original for reference
            };
        }
        return post;
    });
}


async function compressImage(buffer, mimetype) {
    try {
        // Only compress image files
        if (!mimetype.startsWith('image/')) {
            return buffer;
        }

        const sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();

        // Skip compression for very small images
        if (buffer.length < 100000) { // Less than 100KB
            return buffer;
        }

        // Convert ALL images to WebP for maximum compression
        // Increased effort for better compression, reduced quality for faster processing
        const compressedBuffer = await sharpInstance
            .webp({
                quality: 75,  // Reduced quality for faster compression
                effort: 4     // Reduced effort for faster processing
            })
            .toBuffer();


        return compressedBuffer;
    } catch (error) {
        console.error("Image compression failed, using original:", error.message);
        return buffer;
    }
}

async function uploadToSupabase(file) {
    if (!file) return null;
    if (!supabase) throw new Error("Supabase client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE/ANON.");


    // Compress the image
    const compressedBuffer = await compressImage(file.buffer, file.mimetype);

    const safeBase = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-z0-9-_]/gi, "_");
    const key = `posts/${Date.now()}_${safeBase}.webp`;

    // Use Promise.all for parallel processing if needed, but for now keep sequential
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(supabaseBucket)
        .upload(key, compressedBuffer, { contentType: 'image/webp', upsert: false });

    if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(key);
    // Return both public URL and the storage key so callers can delete the object later
    return { publicUrl: data.publicUrl, key };
}

// Helper to extract the storage key from a public URL (assumes default Supabase public URL structure)
function extractStorageKey(publicUrl) {
    if (!publicUrl) return null;
    try {
        const u = new URL(publicUrl);
        // supabase.publicUrl looks like https://<project>.supabase.co/storage/v1/object/public/<bucket>/<key>
        const parts = u.pathname.split('/');
        // find the index of the bucket then the rest is the key
        const idx = parts.indexOf('public');
        if (idx >= 0 && parts.length > idx + 2) {
            // parts after 'public' include bucket and key pieces
            const keyParts = parts.slice(idx + 2);
            return keyParts.join('/');
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Initialize database tables
async function createTables() {
    await sql`
        CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        profilephoto TEXT
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        createDate TIMESTAMP,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        authorid INTEGER,
        FOREIGN KEY (authorid) REFERENCES users (id)
        )
    `;
    // Add imageurl column if it doesn't exist
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS imageurl TEXT`;

    // Add profilephoto column if it doesn't exist
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profilephoto TEXT`;

    // Reset sequences to avoid duplicate key errors
    await sql`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM users))`;
    await sql`SELECT setval('posts_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM posts))`;
}

// Call createTables on startup
createTables().catch(console.error);

const app = express();
// Configure Helmet with HSTS and a minimal Content-Security-Policy.
// Allow images/connect to Supabase origin when configured. Keep 'unsafe-inline'
// for styles because templates use inline styles; remove it later when templates are cleaned.
const supabaseOrigin = supabaseUrl ? (() => { try { return new URL(supabaseUrl).origin } catch(e){ return null } })() : null;
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
    imgSrc: ["'self'", 'data:', supabaseOrigin || "'self'"],
    connectSrc: ["'self'", supabaseOrigin || "'self'"],
    fontSrc: ["'self'", 'https:', 'data:'],
    frameAncestors: ["'none'"], // Prevent embedding in iframes (like Netflix)
    // Additional security headers for content protection
    objectSrc: ["'none'"], // Prevent plugins
    baseUri: ["'self'"]
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: cspDirectives
    },
    hsts: {
        // 60 days
        maxAge: 60 * 24 * 60 * 60,
        includeSubDomains: false
    }
}));

// Additional content protection headers
app.use((req, res, next) => {
    // Prevent caching of images to make downloading harder
    if (req.path.includes('/post/') || req.path.includes('/download/') || req.path.includes('/api/media/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    // Prevent embedding in iframes
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// If running behind a proxy (Heroku, Cloud Run, Railway, etc.) enable trust proxy
// so express can correctly detect secure (HTTPS) requests.
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || process.env.RAILWAY_PROJECT_ID) {
    app.set('trust proxy', 1);
}

// Validate critical environment variables early and fail fast with helpful guidance
function validateEnv() {
    const required = [
        { name: 'DATABASE_URL', ok: !!process.env.DATABASE_URL },
        { name: 'JWTSECRET', ok: !!process.env.JWTSECRET },
    ];

    const missing = required.filter(r => !r.ok).map(r => r.name);
    if (missing.length) {
        console.error('Missing required environment variables:', missing.join(', '));
        console.error('Add them to your .env or Render environment for production. Aborting.');
        process.exit(1);
    }
}

validateEnv();
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: false}))
app.use(express.static("public"));
app.use(cookieParser())

app.use(function(req, res, next){
    res.locals.filterUserHTML = function(content){
        return sanitiseHTML(marked.parse(content), {
            allowedTags: ["p", "br", "ul", "italic", "li", "ol", "strong", "bold", "i", "h1", "h2", "h3", "h4", "h5", "h6"],
            allowedAttributes: {}
        })
    }

    res.locals.errors =[]
    try{
        const decoded = jwt.verify(req.cookies.ourSimpleApp, process.env.JWTSECRET)
        req.user=decoded
    }
    catch(err){
        req.user=false
    }
    res.locals.user=req.user
    next()
})

app.get("/", async (req, res) => {
    if (req.user){
        const posts = await sql`SELECT * FROM posts WHERE authorid = ${req.user.userid} ORDER BY createDate DESC`
        const [userData] = await sql`SELECT * FROM users WHERE id = ${req.user.userid}`
        
        // Protect image URLs with tokens
        const protectedPosts = protectPostImages(posts);

        return res.render("home",{posts: protectedPosts, user: { ...req.user, profilephoto: userData.profilephoto }})
    }
    res.render("homepage");
});

// Explicit home route (useful for Back links)
app.get('/home', mustBeLoggedIn, async (req, res) => {
    const posts = await sql`SELECT * FROM posts WHERE authorid = ${req.user.userid} ORDER BY createDate DESC`
    const [userData] = await sql`SELECT * FROM users WHERE id = ${req.user.userid}`
    const protectedPosts = protectPostImages(posts);
    return res.render('home', { posts: protectedPosts, user: { ...req.user, profilephoto: userData.profilephoto } })
});

// Dashboard route (useful for Back links from create/edit/post pages)
app.get('/dashboard', mustBeLoggedIn, async (req, res) => {
    const posts = await sql`SELECT * FROM posts WHERE authorid = ${req.user.userid} ORDER BY createDate DESC`
    const [userData] = await sql`SELECT * FROM users WHERE id = ${req.user.userid}`
    const protectedPosts = protectPostImages(posts);
    return res.render('dashboard', { posts: protectedPosts, user: { ...req.user, profilephoto: userData.profilephoto } })
});

app.get("/login",(req, res)=> {
    res.render("login")
})

app.get("/logout", (req, res)=>{
    res.clearCookie("ourSimpleApp")
    res.redirect("/")
})

app.post("/search-user", mustBeLoggedIn, async (req, res) => {
    const username = req.body.username.trim();
    if (!username) {
        return res.redirect("/");
    }

    const [user] = await sql`SELECT * FROM users WHERE username = ${username}`;
    if (!user) {
        const userPosts = await sql`SELECT * FROM posts WHERE authorid = ${req.user.userid} ORDER BY createDate DESC`;
        const protectedUserPosts = protectPostImages(userPosts);
        return res.render("home", {
            posts: protectedUserPosts,
            user: req.user,
            searchError: "No username found"
        });
    }

    const posts = await sql`SELECT * FROM posts WHERE authorid = ${user.id} ORDER BY createDate DESC`;
    const protectedPosts = protectPostImages(posts);
    return res.render("user-profile", { posts: protectedPosts, user });
});

// login route with rate limiter applied below

// Define login-specific rate limiter
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
        req.rateLimitExceeded = true;
        next();
    }
});

// Apply limiter to login route
app.post('/login', loginLimiter, async (req, res) => {
    let errors = []

    if (req.rateLimitExceeded) {
        errors = ["Too many login attempts from this IP, please try again later."]
        return res.render("login", {errors, username: req.body.username || ""})
    }

    if (typeof req.body.username !== "string") req.body.username=""
    if (typeof req.body.password !== "string") req.body.password=""
    if (req.body.username.trim()=="") errors=["invalid username or password"]
    if (req.body.password=="") errors=["invalid username or password"]
    if (errors.length){
        return res.render("login",{errors, username: req.body.username})
    }
    const [userInQuestion] = await sql`SELECT * FROM users WHERE username = ${req.body.username}`

    if (!userInQuestion){
        errors = ["Invalid username or password"]
        return res.render("login", {errors, username: req.body.username})
    }
    const match = bcrypt.compareSync(req.body.password,userInQuestion.password)
    if (!match){
        errors = ["Invalid username or password"]
        return res.render("login", {errors, username: req.body.username})
    }
    console.log(`User ${userInQuestion.username} logged in`)
    const ourTokenValue = jwt.sign({exp: Math.floor(Date.now()/1000) + (60*60), userid: userInQuestion.id, username: userInQuestion.username}, process.env.JWTSECRET)

    res.cookie("ourSimpleApp", ourTokenValue,{
        httpOnly: true,
        // Ensure cookies marked Secure when in production (sent only over HTTPS)
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000*60*60*24
    })

    res.redirect("/")

    })

function mustBeLoggedIn(req,res,next) {
    if(req.user){
        return next()
    }
    return res.redirect("/")
}

app.get("/create-post",mustBeLoggedIn,(req,res)=>{
    res.render("create-post")
})    

function share(req) {
    const errors = []
    if (typeof req.body.title !== "string") req.body.title = ""
    if (typeof req.body.body !== "string") req.body.body = ""

    req.body.title=sanitiseHTML(req.body.title.trim(),{allowedTags: [],allowedAttributes: {}})
    req.body.body=sanitiseHTML(req.body.body.trim(),{allowedTags: [],allowedAttributes: {}})
    if (!req.body.title)errors.push("provide a title")
    if (!req.body.body)errors.push("provide content")

    return errors

}

app.get("/edit-post/:id", mustBeLoggedIn, async (req,res)=>{
    const [post] = await sql`SELECT * FROM posts WHERE id = ${req.params.id}`
    
    if(!post){
        return res.redirect("/")
    }

    if(post.authorid !== req.user.userid){
        return res.redirect("/")
    }
    
    res.render("edit-post",{post})
})

app.post("/edit-post/:id",mustBeLoggedIn, upload.single("image"), async (req,res) => {
    try {
        const [post] = await sql`SELECT * FROM posts WHERE id = ${req.params.id}`
        
        if(!post){
            return res.redirect("/")
        }

        if(post.authorid !== req.user.userid){
            return res.redirect("/")
        }
        const errors = share(req)
        if (errors.length) {
            // Preserve submitted title/body so the user doesn't lose their edits
            return res.render("edit-post", { errors, title: req.body.title, body: req.body.body, post })
        }
        let newImageUrl = null;
        let newImageKey = null;

        if (req.file) {
            try {
                const uploaded = await uploadToSupabase(req.file)
                if (uploaded && uploaded.publicUrl) {
                    newImageUrl = uploaded.publicUrl
                    newImageKey = uploaded.key
                }
            } catch (e) {
                console.error("Upload to Supabase failed", e)
                // Multer file size exceeded will be caught earlier, but if it bubbles here check code/message
                const msg = (e && e.code === 'LIMIT_FILE_SIZE') ? 'Selected image is too large. Maximum allowed size is 10 MB.' : 'Image upload failed. Please try again.'
                const fieldErrors = { image: [msg] };
                return res.render("edit-post", { fieldErrors, title: req.body.title, body: req.body.body, post })
            }
        }
        

        if (newImageUrl) {
            const oldPublicUrl = post.imageurl

            await sql`UPDATE posts SET title = ${req.body.title}, body = ${req.body.body}, imageurl = ${newImageUrl} WHERE id = ${req.params.id}`

            // Attempt to delete previous file from Supabase storage (best-effort)
            try {
                if (oldPublicUrl && supabase) {
                    const oldKey = extractStorageKey(oldPublicUrl)
                    if (oldKey) {
                        const { error: removeError } = await supabase.storage.from(supabaseBucket).remove([oldKey])
                        if (removeError) {
                            console.warn('Failed to remove old image from Supabase:', removeError)
                        } else {
                        }
                    }
                }
            } catch (removeErr) {
                console.warn('Error while attempting to remove old Supabase image:', removeErr)
            }
        } else {
            await sql`UPDATE posts SET title = ${req.body.title}, body = ${req.body.body} WHERE id = ${req.params.id}`
        }
        res.redirect(`/post/${req.params.id}`)
    } catch (err) {
        console.error('Error in /edit-post/:id handler', err && err.stack ? err.stack : err)
        // Render edit page with a generic error message so the user can retry
        // If the error is a Multer file size limit error it will have code 'LIMIT_FILE_SIZE'
        if (err && err.code === 'LIMIT_FILE_SIZE') {
            res.locals.errors = ['Selected image is too large. Maximum allowed size is 10 MB.']
            return res.render('edit-post', { errors: res.locals.errors, post: (typeof post !== 'undefined' ? post : null), title: req.body && req.body.title ? req.body.title : (post ? post.title : ''), body: req.body && req.body.body ? req.body.body : (post ? post.body : '') })
        }
        res.locals.errors = ['An internal error occurred. Please try again later.']
        return res.render('edit-post', { errors: res.locals.errors, post: (typeof post !== 'undefined' ? post : null), title: req.body && req.body.title ? req.body.title : (post ? post.title : ''), body: req.body && req.body.body ? req.body.body : (post ? post.body : '') })
    }
})


app.post("/delete-post/:id", mustBeLoggedIn, async (req,res) =>{
    const [post] = await sql`SELECT * FROM posts WHERE id = ${req.params.id}`
    
    if(!post){
        return res.redirect("/")
    }

    if(post.authorid !== req.user.userid){
        return res.redirect("/")
    }

    await sql`DELETE FROM posts WHERE id = ${req.params.id}`
    res.redirect("/")

})


app.get("/post/:id", async (req, res)=> {
    const [post] = await sql`SELECT posts.*, users.username FROM posts INNER JOIN users ON posts.authorid = users.id WHERE posts.id = ${req.params.id}`

    if (!post){
        return res.redirect("/")
    }
    const isAuthor =post.authorid === req.user.userid
    
    // Generate protected image token (Netflix-style)
    let protectedImageUrl = null;
    if (post.imageurl) {
        const token = generateImageToken(post.imageurl, post.id);
        protectedImageUrl = `/api/media/${token}`;
    }
    
    res.render("single-post",{
        post: { ...post, imageurl: protectedImageUrl, originalImageUrl: post.imageurl },
        isAuthor, 
        ogImage: post.imageurl // Keep original for OG tags
    })
})

// Health check for hosting providers (Render, etc.)
app.get('/health', (req, res) => {
    res.send('OK');
});

// Rate limiter for media endpoint (prevent abuse)
const mediaLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
});

// Authenticated image serving endpoint (Netflix-style protection)
// Images are served through this endpoint with tokens to prevent direct URL access
app.get('/api/media/:token', mediaLimiter, async (req, res) => {
    try {
        const tokenData = verifyImageToken(req.params.token);
        
        if (!tokenData) {
            return res.status(403).send('Access denied');
        }
        
        const imageUrl = tokenData.url;
        
        // Verify the image belongs to a post (additional security)
        if (tokenData.postId) {
            const [post] = await sql`SELECT id FROM posts WHERE id = ${tokenData.postId}`;
            if (!post) {
                return res.status(404).send('Image not found');
            }
        }
        
        // Check referrer to ensure request comes from our site
        const referer = req.get('referer');
        const host = req.get('host');
        if (referer && !referer.includes(host) && process.env.NODE_ENV === 'production') {
            // In production, require referer to match our domain
            return res.status(403).send('Access denied');
        }
        
        // Fetch image from Supabase
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        if (!response.ok) {
            return res.status(404).send('Image not found');
        }
        
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/webp';
        
        // Set maximum security headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'no-referrer');
        // Prevent direct download - force inline display only
        res.setHeader('Content-Disposition', 'inline; filename="image"');
        // Add CORS restrictions
        res.setHeader('Access-Control-Allow-Origin', req.get('origin') || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        res.send(Buffer.from(imageBuffer));
    } catch (error) {
        console.error('Image serving error:', error);
        res.status(500).send('Error loading image');
    }
});

// Download route for images - DISABLED for content protection
// app.get("/download/:id", async (req, res) => {
//     const [post] = await sql`SELECT imageurl, title FROM posts WHERE id = ${req.params.id}`
//     
//     if (!post || !post.imageurl) {
//         return res.status(404).send("Image not found")
//     }
//     
//     try {
//         // Fetch the image from Supabase
//         const response = await fetch(post.imageurl)
//         if (!response.ok) {
//             throw new Error("Failed to fetch image")
//         }
//         
//         const imageBuffer = await response.arrayBuffer()
//         const filename = `${post.title.replace(/[^a-z0-9]/gi, '_')}.webp`
//         
//         res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
//         res.setHeader('Content-Type', 'image/webp')
//         res.send(Buffer.from(imageBuffer))
//     } catch (error) {
//         console.error("Download error:", error)
//         res.status(500).send("Download failed")
//     }
// })

app.post("/upload-profile-photo", mustBeLoggedIn, upload.single("profilePhoto"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploaded = await uploadToSupabase(req.file);
        if (uploaded && uploaded.publicUrl) {
            await sql`UPDATE users SET profilephoto = ${uploaded.publicUrl} WHERE id = ${req.user.userid}`;
            return res.json({ success: true, profilePhotoUrl: uploaded.publicUrl });
        } else {
            return res.status(500).json({ error: 'Failed to upload image' });
        }
    } catch (error) {
        console.error('Profile photo upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post("/create-post",mustBeLoggedIn, upload.single("image"), async (req,res)=> {
    console.time('post-upload-time')
    const errors = share(req)
    if (errors.length){
        // preserve submitted values
        return res.render("create-post",{errors, title: req.body.title, body: req.body.body})
    }

    // Require an image to be uploaded for posts
    if (!req.file) {
        const msg = 'Upload an image for this post.';
        const fieldErrors = { image: [msg] };
        return res.render("create-post", { fieldErrors, title: req.body.title, body: req.body.body })
    }

    let imageUrl = null
    try {
        const uploaded = await uploadToSupabase(req.file)
        imageUrl = uploaded && uploaded.publicUrl ? uploaded.publicUrl : null
        console.log(`User ${req.user.username} uploaded an image`)
    } catch (e) {
        console.error("Upload to Supabase failed", e)
        const msg = (e && e.code === 'LIMIT_FILE_SIZE') ? 'Selected image is too large. Maximum allowed size is 10 MB.' : 'Image upload failed. Please try again.'
        const fieldErrors = { image: [msg] };
        return res.render("create-post", { fieldErrors, title: req.body.title, body: req.body.body })
    }

    const [realPost] = await sql`
        INSERT INTO posts (title, body, authorid, createDate, imageurl)
        VALUES (${req.body.title}, ${req.body.body}, ${req.user.userid}, ${new Date().toISOString()}, ${imageUrl})
        RETURNING *
    `
    console.log(`New post created by ${req.user.username}: ${req.body.title}`)
    console.timeEnd('post-upload-time')
    res.redirect(`/post/${realPost.id}`)
})

app.post("/register", async (req, res)=>{
    
    const fieldErrors = { username: [], password: [] }
    if (typeof req.body.username !== "string") req.body.username=""
    if (typeof req.body.password !== "string") req.body.password=""
    
    req.body.username=req.body.username.trim()

    if (!req.body.username) { fieldErrors.username.push("Invalid username") }
    if (req.body.username && req.body.username.length<3) {  fieldErrors.username.push("Username must be at least 3 characters") }
    if (req.body.username && req.body.username.length>20) {  fieldErrors.username.push("Username must be at most 20 characters") }
    if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) { fieldErrors.username.push("Username may only contain letters and numbers") }

    const [usernameCheck] = await sql`SELECT * FROM users WHERE username = ${req.body.username}`
    
    if (usernameCheck) { fieldErrors.username.push("Username already exists") }

    if (!req.body.password) {fieldErrors.password.push("Invalid password") }
    if (req.body.password && req.body.password.length<5) {  fieldErrors.password.push("Password must be at least 5 characters") }
    if (req.body.password && req.body.password.length>64) {  fieldErrors.password.push("Password must be at most 64 characters") }
    // Require at least one letter and one number for stronger passwords
    if (req.body.password && (!/[A-Za-z]/.test(req.body.password) || !/\d/.test(req.body.password))) {
        fieldErrors.password.push("Password must contain at least one letter and one number")
    }

    if (fieldErrors.username.length || fieldErrors.password.length){
        return res.render("homepage",{fieldErrors})
    }

    const salt= bcrypt.genSaltSync(10)
    req.body.password=bcrypt.hashSync(req.body.password, salt)

    const [ourUser] = await sql`
        INSERT INTO users (username, password)
        VALUES (${req.body.username}, ${req.body.password})
        RETURNING *
    `

    console.log(`New user registered: ${req.body.username}`)

    const ourTokenValue = jwt.sign({exp: Math.floor(Date.now()/1000) + (60*60), userid: ourUser.id, username: ourUser.username}, process.env.JWTSECRET)

    res.cookie("ourSimpleApp", ourTokenValue,{
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000*60*60*24
    })

    res.redirect("/")
    
})
const PORT = process.env.PORT || 3000;

// Error handler to catch Multer file-size errors and show user-friendly messages
app.use(async function multerErrorHandler(err, req, res, next) {
    if (!err) return next();

    // Multer sets err.code === 'LIMIT_FILE_SIZE' when file is too large
    if (err && (err.code === 'LIMIT_FILE_SIZE' || (err.name === 'MulterError' && err.code))) {
        const msg = 'Selected image is too large. Maximum allowed size is 10 MB.';

        try {
            // Render create form if this was a create request and preserve title/body
            if (req.path && req.path.startsWith('/create-post')) {
                const fieldErrors = { image: [msg] };
                return res.status(400).render('create-post', { fieldErrors, title: req.body && req.body.title ? req.body.title : '', body: req.body && req.body.body ? req.body.body : '' });
            }

            // Render edit form if this was an edit request; attempt to load post so template can render
            if (req.path && req.path.startsWith('/edit-post')) {
                const id = req.params && req.params.id ? req.params.id : (() => {
                    const parts = req.path.split('/'); return parts.length > 2 ? parts[2] : null;
                })();
                let post = null;
                if (id) {
                    try {
                        const [p] = await sql`SELECT * FROM posts WHERE id = ${id}`;
                        post = p || null;
                    } catch (dbErr) {
                        console.warn('Could not load post for error page:', dbErr && dbErr.message ? dbErr.message : dbErr);
                        post = null;
                    }
                }
                const fieldErrors = { image: [msg] };
                return res.status(400).render('edit-post', { fieldErrors, title: req.body && req.body.title ? req.body.title : '', body: req.body && req.body.body ? req.body.body : '', post });
            }
        } catch (renderErr) {
            console.error('Error while handling Multer error:', renderErr && renderErr.stack ? renderErr.stack : renderErr);
            // Fall through to generic handler below
        }
        // Fallback: send JSON or plain text
        return res.status(400).send(msg);
    }

    // Unknown error -> pass to default handler
    next(err);
});

app.listen(PORT, () => {
});
