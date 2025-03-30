const express = require("express");
const app = express();
const path = require("path");
const axios = require("axios");
const mysql = require("mysql");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");

require("dotenv").config();
const bloxlinkapi = process.env.BLOXLINK_API_KEY;

const port = 10183;

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "J@ydeniamrichh2",
  database: "sims_data",
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

const username = 'TestUser123';  // Discord username (you can change this)
const password = 'password123';  // Plain password (you can change this)

const insertQuery = `
  INSERT INTO users (Discord_Username, password)
  VALUES (?, ?)
`;

db.query(
  "INSERT INTO users (Discord_Username, password, discord_id) VALUES (?, ?, ?)",
  ['TestUser123', 'password123', '123456789'],
  (err) => {
    if (err) {
      console.error('Error inserting test user:', err);
    } else {
      console.log('Test user inserted successfully');
    }
  }
);


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

app.get("/admin/account-settings/", (req, res) => {
  res.render("accountsettings.ejs", {
    title: "Navigator SIMS",
    robloxaccountusername: "No Account Linked",
    discordaccountusername: "No Account Linked",
    csrfToken: req.csrfToken() // Add this line
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Check if username and password are provided
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  // Query the database for a user with the given username
  db.query("SELECT * FROM users WHERE Discord_Username = ?", [username], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length > 0) {
      const user = results[0];

      // Check if the password matches the one in the database (assuming plaintext for now)
      if (user.password === password) {
        // Password matches, create a session cookie
        const sessionCookie = crypto.randomBytes(32).toString("hex");

        // Update the session cookie in the database for this user
        db.query("UPDATE users SET session_cookie = ? WHERE Discord_Username = ?", [sessionCookie, username], (err) => {
          if (err) {
            console.error("Error updating session cookie:", err);
            return res.status(500).json({ error: "Failed to update session cookie" });
          }

          // Set the session cookie in the user's browser
          res.cookie("session_token", sessionCookie, {
            maxAge: 24 * 60 * 60 * 1000,  // Expires in 1 day
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",  // Ensure it is secure in production
          });

          // Redirect to home/dashboard page after successful login
          return res.redirect("/home");
        });
      } else {
        // Password doesn't match
        return res.status(401).json({ error: "Invalid username or password" });
      }
    } else {
      // Username not found
      return res.status(401).json({ error: "User not found" });
    }
  });
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

app.get("/api/behavior/negative/add/", (req, res) => {
  const { userid, amount, reason} = req.query
});

app.get("/api/game/server/init/", (req, res) => {
  const { LicenceType, GroupId, OwnerUserId, universeId } = req.query
});

app.get("/admin/sims-settings", (req, res) => {
  const { AccountType, User } = req.query
  
})

app.post("/api/settings/verify/roblox/bloxlink", async (req, res) => {
  const { robloxUserId } = req.body;

  if (!robloxUserId) {
      return res.status(400).json({ error: "Roblox User ID is required" });
  }

  if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
  }

  try {
      // Call the new Bloxlink API to verify if the Roblox ID belongs to the user
      const response = await fetch(`https://api.blox.link/v4/public/guilds/1327664670403727391/roblox-to-discord/${robloxUserId}`, {
          headers: { "Authorization": bloxlinkapi }
      });

      const data = await response.json();

      if (!data || !data.discordId) {
          return res.status(403).json({ error: "Verification failed. Make sure your Roblox account is linked to your Discord." });
      }

      // Ensure the Discord ID from Bloxlink matches the logged-in user
      if (data.discordId !== req.user.Discord_Id) {
          return res.status(403).json({ error: "This Roblox account is not linked to your Discord." });
      }

      // Update the user's Roblox ID in the database
      db.query("UPDATE users SET Roblox_Id = ? WHERE Discord_Id = ?", [robloxUserId, req.user.Discord_Id], (err, results) => {
          if (err) {
              console.error("Database error:", err);
              return res.status(500).json({ error: "Internal server error" });
          }

          res.json({ success: true, message: "Roblox account linked successfully!" });
      });

  } catch (error) {
      console.error("Bloxlink API error:", error);
      return res.status(500).json({ error: "Failed to verify with Bloxlink." });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
