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

app.get("/api/auth/discord/callback", async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.redirect("/");
  }

  try {
    // Step 1: Exchange the authorization code for an access token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token", 
      new URLSearchParams({
        client_id: process.env.DISCORD_AUTH_CLIENTID,
        client_secret: process.env.DISCORD_AUTH_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: process.env.DISCORD_AUTH_CALLBACK_URL,
        scope: 'identify openid',
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Step 2: Use the access token to fetch user data from Discord
    const discordUserResponse = await axios.get("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const discordId = discordUserResponse.data.id;
    const username = discordUserResponse.data.username;
    const avatar = discordUserResponse.data.avatar;
    const discriminator = discordUserResponse.data.discriminator;

    const profilePicture = avatar 
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=256` 
      : `https://cdn.discordapp.com/embed/avatars/${discriminator % 5}.png`;

    // Step 3: Handle database query (ensure async/await is used for better readability)
    const user = await db.query("SELECT * FROM users WHERE discord_id = ?", [discordId]);

    const sessionCookie = crypto.randomBytes(32).toString("hex");

    if (user.length > 0) {
      // User exists, update their details
      await db.query(
        "UPDATE users SET username = ?, session_cookie = ?, profile_picture = ? WHERE discord_id = ?",
        [username, sessionCookie, profilePicture, discordId]
      );
    } else {
      // User does not exist, insert new user
      await db.query(
        "INSERT INTO users (username, discord_id, session_cookie, profile_picture) VALUES (?, ?, ?, ?)",
        [username, discordId, sessionCookie, profilePicture]
      );
    }

    // Step 4: Set the session cookie and redirect to dashboard
    res.cookie("session_token", sessionCookie, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return res.redirect("/dashboard");

  } catch (err) {
    console.error("Error during Discord OAuth2 process:", err);
    return res.redirect("/");  // In case of error, redirect to home
  }
});

app.get("/auth/login/discord", async (req, res) => {
  const discordAuthUrl = process.env.DISCORD_AUTH_URL;
  res.redirect(discordAuthUrl);
});

app.get("/api/behavior/positive/add/", (req, res) => {
  const { userid, amount, reason } = req.query;
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
