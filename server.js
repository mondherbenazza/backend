require("dotenv").config()
const jwt = require("jsonwebtoken");
const marked = require("marked");
const sanitiseHTML= require('sanitize-html');
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const postgres = require("postgres");

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
const upload = multer({ storage: multer.memoryStorage() });

// Supabase client for Storage uploads
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "uploads"; // set your bucket name via env
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Log Supabase configuration on startup
console.log("Supabase config:", {
    url: supabaseUrl ? "✓ Set" : "✗ Missing",
    key: supabaseKey ? "✓ Set" : "✗ Missing", 
    bucket: supabaseBucket,
    client: supabase ? "✓ Initialized" : "✗ Failed"
});

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

        // Compress based on image type
        let compressedBuffer;
        if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
            compressedBuffer = await sharpInstance
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();
        } else if (mimetype === 'image/png') {
            compressedBuffer = await sharpInstance
                .png({ quality: 85, compressionLevel: 9 })
                .toBuffer();
        } else if (mimetype === 'image/webp') {
            compressedBuffer = await sharpInstance
                .webp({ quality: 85 })
                .toBuffer();
        } else {
            // For other formats, convert to JPEG
            compressedBuffer = await sharpInstance
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();
        }

        const compressionRatio = ((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1);
        console.log(`Image compressed: ${(buffer.length / 1024).toFixed(1)}KB → ${(compressedBuffer.length / 1024).toFixed(1)}KB (${compressionRatio}% reduction)`);
        
        return compressedBuffer;
    } catch (error) {
        console.error("Image compression failed, using original:", error.message);
        return buffer;
    }
}

async function uploadToSupabase(file) {
    if (!file) return null;
    if (!supabase) throw new Error("Supabase client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE/ANON.");
    
    console.log("Processing image:", {
        filename: file.originalname,
        originalSize: `${(file.buffer.length / 1024).toFixed(1)}KB`,
        mimetype: file.mimetype
    });
    
    // Compress the image
    const compressedBuffer = await compressImage(file.buffer, file.mimetype);
    
    const extension = path.extname(file.originalname).toLowerCase() || "";
    const safeBase = path
        .basename(file.originalname, extension)
        .replace(/[^a-z0-9-_]/gi, "_");
    const key = `posts/${Date.now()}_${safeBase}${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(supabaseBucket)
        .upload(key, compressedBuffer, { contentType: file.mimetype, upsert: false });
    
    if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(key);
    console.log("Upload successful, public URL:", data.publicUrl);
    return data.publicUrl;
}

// Initialize database tables
async function createTables() {
    await sql`
        CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
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
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', supabaseOrigin || "'self'"],
    connectSrc: ["'self'", supabaseOrigin || "'self'"],
    fontSrc: ["'self'", 'https:', 'data:'],
    frameAncestors: ["'self'"]
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

// If running behind a proxy (Heroku, Cloud Run, etc.) enable trust proxy
// so express can correctly detect secure (HTTPS) requests.
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Redirect HTTP -> HTTPS in production
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.secure === false && req.get('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    }
    next();
});
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
    console.log(req.user)
    next()
})

app.get("/", async (req, res) => {
    if (req.user){
        const posts = await sql`SELECT * FROM posts WHERE authorid = ${req.user.userid} ORDER BY createDate DESC`

        return res.render("dashboard",{posts})
    }
    res.render("homepage");
});
app.get("/login",(req, res)=> {
    res.render("login")
})

app.get("/logout", (req, res)=>{
    res.clearCookie("ourSimpleApp")
    res.redirect("/")
})

app.post("/login", async (req, res) => {
    let errors = []

    if (typeof req.body.username !== "string") req.body.username=""
    if (typeof req.body.password !== "string") req.body.password=""
    if (req.body.username.trim()=="") errors=["invalid username or password"]
    if (req.body.password=="") errors=["invalid username or password"]
    if (errors.length){
        return res.render("login",{errors})
    }
    const [userInQuestion] = await sql`SELECT * FROM users WHERE username = ${req.body.username}`

    if (!userInQuestion){
        errors = ["Invalid username or password"]
        return res.render("login", {errors})
    }
    const match = bcrypt.compareSync(req.body.password,userInQuestion.password)
    if (!match){
        errors = ["Invalid username or password"]
        return res.render("login", {errors})
    }
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
    const [post] = await sql`SELECT * FROM posts WHERE id = ${req.params.id}`
    
    if(!post){
        return res.redirect("/")
    }

    if(post.authorid !== req.user.userid){
        return res.redirect("/")
    }
    const errors = share(req)
    if (errors.length) {
        return res.render("edit-post", {errors})
    }
    let imageUrlFragment = []
    if (req.file) {
        try {
            const newUrl = await uploadToSupabase(req.file)
            imageUrlFragment.push(sql`imageurl = ${newUrl}`)
        } catch (e) {
            console.error("Upload to Supabase failed", e)
            res.locals.errors = ["Image upload failed. Please try again."]
            return res.render("edit-post", { errors: res.locals.errors, post })
        }
    }

    if (imageUrlFragment.length) {
        await sql`UPDATE posts SET title = ${req.body.title}, body = ${req.body.body}, ${sql.join(imageUrlFragment, sql`, `)} WHERE id = ${req.params.id}`
    } else {
        await sql`UPDATE posts SET title = ${req.body.title}, body = ${req.body.body} WHERE id = ${req.params.id}`
    }
    res.redirect(`/post/${req.params.id}`)
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
    res.render("single-post",{post, isAuthor})
})

// Health check for hosting providers (Render, etc.)
app.get('/health', (req, res) => {
    res.status(200).json({status: 'ok'});
});

// Download route for images
app.get("/download/:id", async (req, res) => {
    const [post] = await sql`SELECT imageurl, title FROM posts WHERE id = ${req.params.id}`
    
    if (!post || !post.imageurl) {
        return res.status(404).send("Image not found")
    }
    
    try {
        // Fetch the image from Supabase
        const response = await fetch(post.imageurl)
        if (!response.ok) {
            throw new Error("Failed to fetch image")
        }
        
        const imageBuffer = await response.arrayBuffer()
        const filename = `${post.title.replace(/[^a-z0-9]/gi, '_')}.jpg`
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Type', 'image/jpeg')
        res.send(Buffer.from(imageBuffer))
    } catch (error) {
        console.error("Download error:", error)
        res.status(500).send("Download failed")
    }
})

app.post("/create-post",mustBeLoggedIn, upload.single("image"), async (req,res)=> {
    const errors = share(req)
    if (errors.length){
        return res.render("create-post",{errors})
    }
    let imageUrl = null
    if (req.file) {
        try {
            imageUrl = await uploadToSupabase(req.file)
        } catch (e) {
            console.error("Upload to Supabase failed", e)
            res.locals.errors = ["Image upload failed. Please try again."]
            return res.render("create-post", { errors: res.locals.errors })
        }
    }
    const [realPost] = await sql`
        INSERT INTO posts (title, body, authorid, createDate, imageurl) 
        VALUES (${req.body.title}, ${req.body.body}, ${req.user.userid}, ${new Date().toISOString()}, ${imageUrl})
        RETURNING *
    `
    res.redirect(`/post/${realPost.id}`)
})

app.post("/register", async (req, res)=>{
    const errors = []
    if (typeof req.body.username !== "string") req.body.username=""
    if (typeof req.body.password !== "string") req.body.password=""
    
    req.body.username=req.body.username.trim()

    if (!req.body.username) errors.push("Invalid username")
    if (req.body.username && req.body.username.length<3) errors.push("username < 3")
    if (req.body.username && req.body.username.length>10) errors.push("username > 10")
    if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push("username a z 1 9")

    const [usernameCheck] = await sql`SELECT * FROM users WHERE username = ${req.body.username}`
    
    if (usernameCheck) errors.push("Username exists")

    if (!req.body.password) errors.push("Invalid password")
    if (req.body.password && req.body.password.length<5) errors.push("password < 5")
    if (req.body.password && req.body.password.length>10) errors.push("password > 11")
            
    if (errors.length){
        return res.render("homepage",{errors})
    }

    const salt= bcrypt.genSaltSync(10)
    req.body.password=bcrypt.hashSync(req.body.password, salt)
    
    const [ourUser] = await sql`
        INSERT INTO users (username, password) 
        VALUES (${req.body.username}, ${req.body.password})
        RETURNING *
    `
    
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
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});