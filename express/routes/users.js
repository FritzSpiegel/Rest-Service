const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET || "meinKey";

// 🔐 Token Middleware
const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) return res.status(401).send("Token fehlt!");

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).send("Token ungültig oder abgelaufen!");
        req.user = user;
        next();
    });
};

// 🔑 Login-Route
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "password") {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    } else {
        res.status(401).send("Anmeldedaten sind nicht korrekt");
    }
});

// 🚪 Authentifizierungs-Testroute
router.get("/protected", authenticateToken, (req, res) => {
    res.status(200).send("Sie sind authentifiziert!");
});

module.exports = router;
