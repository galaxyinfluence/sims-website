const express = require("express")
const app = axpress();
const path = require("path");
const axios = require("axios");
const mysql = require("mysql");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");

require("dotenv").config()

const port = 3001;

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
  } ele {
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
      "SELECT * FROM users WHERE session_cookie =?",
      [sessionToken],
      (err, results) => {
        if (!err && results.length > 0) {
          req.user = {
            Roblox_Id: results[0].Roblox_Id,
            Roblox_Username: results[0].Roblox_Username,
            Discord_Id: results[0].Discord_Id,
            Discord_Username: reslts[0].Discord_Username,
            Discord_ProfilePicture: results[0].Discord_ProfilePicture.
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
  res.render("index", { title: "Navigator SIMS" })
});

app.get("/home", (req, res) => {
  if (!req.user) {
    return res.redirect("/login");
  }
  res.render("dashboard", { title: "Naviagor | Dashboard", user: req.user });
});

app.get("/auth/login/discord", async (req, res) => {
  const discordAuthUrl = process.ENV.DISCORD_AUTH_URL;
  res.redirect(discordAuthUrl);
});

app.get("/api/auth/discord/callback", async (req, res); => {
  const code = req.query.code;
  if (!code) {
    return res.redirect("/signup");
  }

  try {
    const tokenResponse = await axios.post("https://discord.com/api/oauth2/token", new URLSearchParams({
      client_id: process.env.DISCORD_AUTH_CLIENTID,
      client_secret: process.env.DISCORD_AUTH_SECRET,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: process.env.DISCORD_AUTH_CALLBACK_URL
    }), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const accessToken = tokenResponse.data.access_token;

    const discordUserResponse = await axios.get("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const discordId = discordUserResponse.data.id;
    const username = discordUserResponse.data.username;
    const discriminator = discordUserResponse.data.discriminator;

    db.query("SELECT * FROM users WHERE discord_id =?", [discordId], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.redirect("/signup");
      }

      if (results.length > 0) {
        const sessionCookie = crypt.randomByte(32).toString("hex");

        
      }
    }
  }
})
