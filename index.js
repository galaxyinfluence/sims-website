const express = require("express");
const app = express();
const path = require("path");
const axios = require("axios");
const mysql = require("mysql");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");

require("dotenv").config();

const port = 10183;

const db = mysql.createPool({
  host: "host",
  user: "root",
  password: "password",
  database: "database",
  connectionLimit: 10,
});

db.getConnection((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL database.");
  }
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(csurf({ cookie: true }));

app.use((req, res, next) => {
  const sessionToken = req.cookies.session_token;
  if (sessionToken) {
    db.query(
      "SELECT * FROM users WHERE session_cookie = ?",
      [sessionToken],
      (err, results) => {
        if (!err && results.length > 0) {
          req.user = {
            Roblox_Id: results[0].Roblox_Id,
            Roblox_Username: results[0].Roblox_Username,
            Discord_Id: results[0].Discord_Id,
            Discord_Username: results[0].Discord_Username,
            Discord_ProfilePicture: results[0].Discord_ProfilePicture,
          };
        }
        next();
      }
    );
  } else {
    next();
  }
});

// routes
app.get("/", (req, res) => {
  res.render("index", { title: "Navigator SIMS" });
});

app.get("/home", (req, res) => {
  if (!req.user) {
    return res.redirect("/login");
  }
  res.render("dashboard", { title: "Navigator | Dashboard", user: req.user });
});

app.get("/auth/login/discord", async (req, res) => {
  try {
    const response = await axios.get("http://localhost.polyonax-group.org:3001/auth/discord/callback");
    res.send(response.data);
  } catch (error) {
    console.error("Error during Discord login:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
