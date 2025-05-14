const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const cors = require("cors");
const { validatePerson } = require("./validation/personSchema");
const userRoutes = require("./routes/users"); // 👈 neue Benutzer-Route

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 🌐 CORS aktivieren
app.use(cors());

// 🧠 JSON-Parser + Fehler abfangen, wenn kein gültiges JSON
app.use(express.json({
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            throw new Error("INVALID_JSON");
        }
    }
}));

// Globaler Error-Handler für ungültiges JSON
app.use((err, req, res, next) => {
    if (err.message === "INVALID_JSON") {
        return res.status(400).json({
            errorCode: "BODY_NOT_JSON",
            message: "Body ist nicht im JSON-Format"
        });
    }
    next(err);
});

// 🔐 Middleware zur Authentifizierung (Token-Check)
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET || "your_secret_key";

const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) return res.status(401).send("Token fehlt!");

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).send("Token ungültig oder abgelaufen!");
        req.user = user;
        next();
    });
};

// 🛢️ MySQL-Datenbankverbindung
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 📦 Benutzer-Routen laden
app.use("/", userRoutes);

// ➕ Person hinzufügen
app.post("/person", authenticateToken, (req, res) => {
    const person = req.body;

    const valid = validatePerson(person);
    if (!valid) {
        return res.status(400).json({
            message: "Falsches JSON-Format",
            errors: validatePerson.errors,
        });
    }

    const { vorname, nachname, plz, strasse, ort, telefonnummer, email } = person;
    const query = `
        INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email];

    pool.query(query, values, (err, result) => {
        if (err) {
            console.error("Fehler beim Einfügen der Person:", err);
            return res.status(500).send("Fehler beim Speichern der Person");
        }
        res.status(201).send({ message: "Person hinzugefügt", id: result.insertId });
    });
});

// ✏️ Person aktualisieren
app.put("/person/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const person = req.body;

    const valid = validatePerson(person);
    if (!valid) {
        return res.status(400).json({
            message: "Falsches JSON-Format",
            errors: validatePerson.errors,
        });
    }

    const { vorname, nachname, plz, strasse, ort, telefonnummer, email } = person;
    const query = `
        UPDATE personen
        SET vorname = ?, nachname = ?, plz = ?, strasse = ?, ort = ?, telefonnummer = ?, email = ?
        WHERE id = ?
    `;
    const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email, id];

    pool.query(query, values, (err, result) => {
        if (err) {
            console.error("Fehler beim Aktualisieren der Person:", err);
            return res.status(500).send("Fehler beim Aktualisieren der Person");
        }
        if (result.affectedRows === 0) {
            return res.status(404).send("Person nicht gefunden");
        }
        res.status(200).send({ message: "Person aktualisiert" });
    });
});

// 📋 Alle Personen abrufen
app.get("/person", authenticateToken, (req, res) => {
    pool.query("SELECT * FROM personen", (err, results) => {
        if (err) return res.status(500).send("Fehler beim Abrufen der Personen");
        res.status(200).json(results);
    });
});

// 🔍 Einzelne Person abrufen
app.get("/person/:id", authenticateToken, (req, res) => {
    const { id } = req.params;

    pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).send("Fehler beim Abrufen der Person");
        if (result.length === 0) return res.status(404).send("Person nicht gefunden");
        res.status(200).json(result[0]);
    });
});

// ❌ Person löschen
app.delete("/person/:id", authenticateToken, (req, res) => {
    const { id } = req.params;

    pool.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).send("Fehler beim Löschen der Person");
        if (result.affectedRows === 0) return res.status(404).send("Person nicht gefunden");
        res.status(200).send("Person gelöscht");
    });
});

// 🚀 Server starten
app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
