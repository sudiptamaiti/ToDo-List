//Importing the necessary modules
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import dotenv from "dotenv";
import passport from "passport";
import { Strategy } from "passport-local";
import flash from "connect-flash";
dotenv.config();

//Creating the express app
const app = express();
const PORT = 3000;
const saltRounds = 10;

//Connecting to Database
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});
db.connect();

//Body parsing and declaring static files
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}))


app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

// middleware to pass flash messages to all views
app.use((req, res, next) => {
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

let items = [];

//GET requests Home Page
app.get("/", async (req, res)=>{
    try{
        console.log(req.user);
        if(req.isAuthenticated()){
            const result = await db.query("SELECT * FROM list WHERE user_id = ($1) ORDER BY id ASC",[req.user.id]);
            items = result.rows;

            res.render("index.ejs", {
                listTitle: "To-Do App",
                listItems: items,
            });
        }else{
            res.redirect("/register");
        }   
    }
    catch(err){
        console.log(err);
    }
})

//Register Section
app.get("/register", (req, res)=>{
    res.render("register.ejs");
})

app.post("/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [username]);

    if (checkResult.rows.length > 0) {
      req.flash("error", "Email already exists! Try logging in.");
      return res.redirect("/register");
    } else {
      // Hash password
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log("Error hashing password: ", err);
          req.flash("error", "Something went wrong, please try again.");
          return res.redirect("/register");
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [username, hash]
          );
          const user = result.rows[0];

          req.login(user, (err) => {
            if (err) {
              console.log(err);
              req.flash("error", "Login error, please try again.");
              return res.redirect("/register");
            }
            req.flash("success", "Account created successfully!");
            res.redirect("/");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
    req.flash("error", "Unexpected error, try again.");
    res.redirect("/register");
  }
});


//Login Section
app.get("/login", (req, res)=>{
    res.render("login.ejs");
})

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,   // enables error messages
    successFlash: "Welcome back!" 
}));


//Getting Date and Time Formats
function get_formatted_date(){
    const now = new Date();
    // Format Date - DD-MM-YY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = String(now.getFullYear()).slice(-2); // Last 2 digits of year
    const formattedDate = `${day}-${month}-${year}`;
    return formattedDate;
}
function get_formatted_time(){
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    return formattedTime;
}


//Handing Post request
app.post("/add", async(req, res)=>{
    const new_task = req.body.newItem;
    const date = get_formatted_date();
    const time = get_formatted_time();
    const date_time = time + " | " + date;
    try{
         await db.query("INSERT INTO list (title,date, user_id) VALUES ($1,$2,$3)", [new_task,date_time, req.user.id]);

         res.redirect("/");
    }
    catch(err){
        console.log(err);
    }
})

//handling EDIT POST
app.post("/edit", async(req, res)=>{
    const item = req.body.updatedItemTitle;
    const id = req.body.updatedItemId;
    const date = get_formatted_date();
    const time = get_formatted_time();
    const date_time = time + " | " + date;

    try{
        await db.query("UPDATE list SET title = ($1), date = ($2) WHERE id = ($3) AND user_id = ($4)",[item,date_time,id, req.user.id]);

        res.redirect("/");
    }
    catch(err){
        console.log(err);
    }
})

//Delete the Item
app.post("/delete", async(req,res)=>{
    const item = req.body.deleteItemId;
    try{
        await db.query("DELETE FROM list WHERE id = ($1) AND user_id = ($2)",[item, req.user.id]);

        res.redirect("/");
    }
    catch(err){
        console.log(err);
    }
})

// Add this route in your server.js / app.js

app.post("/logout", (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy(() => {
      res.clearCookie("connect.sid"); // Clears session cookie
      res.redirect("/login"); // Redirect to login page
    });
  });
});


passport.use(new Strategy(
  async function (username, password, done){
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
      if (result.rows.length === 0) {
        return done(null, false, { message: "User not found. Create a new Account" });
      }

      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: "Wrong password" });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));


passport.serializeUser((user, cb)=>{
    cb(null, user);
})

passport.deserializeUser((user, cb)=>{
    cb(null, user);
})

app.listen(PORT, ()=>{
    console.log(`Server is Listening on http://localhost:${PORT} `)
})