const express = require("express")
const app = axpress();
const path = require("path");
const axios = require("axios");
const mysql = require("mysql");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");

const port = 3000;

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
