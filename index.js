import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});
db.connect();

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

let items=[];
app.get("/",async(req,res)=>{
    try{
        const result= await db.query("SELECT * FROM list ORDER BY id ASC");
        items= result.rows;

        res.render("index.ejs",{
            listTitle: "ToDo-List",
            listItems: items
        })
    }
    catch(err){
        console.log(err);
    }
});

app.post("/add",async(req,res)=>{
   const title= req.body.newItem;
   try{
        await db.query("INSERT INTO list (title) VALUES ($1)",[title]);
        res.redirect("/");
   }
   catch(err){
        console.log(err);
   } 
});

app.post("/edit",async(req,res)=>{
    const title=req.body.updatedItemTitle;
    const id=req.body.updatedItemId;

    try{
        await db.query("UPDATE list SET title=$1 WHERE id=$2 ",[title,id]);
        res.redirect("/");
    }catch(err){
        console.log(err);
    }
});

app.post("/delete",async(req,res)=>{
    const id=req.body.deleteItemId;
    try{
        await db.query("DELETE FROM list WHERE id =$1",[id]);
        res.redirect("/");
    }
    catch(err){
        console.log(err);
    }
});

app.listen(port,()=>{
    console.log(`Server running on port`);
});
