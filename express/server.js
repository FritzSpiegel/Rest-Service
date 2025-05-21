const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const cors = require("cors");
const { validatePerson } = require("./validation/personSchema");
const userRoutes = require("./routes/users");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.json({
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            throw new Error("INVALID_JSON");
        }
    }
}));

app.use((err, req, res, next) => {
    if (err.message === "INVALID_JSON") {
        return res.status(400).json({
            errorCode: "BODY_NOT_JSON",
            message: "Body ist nicht im JSON-Format"
        });
    }
    next(err);
});

const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET || "your_secret_key";

const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            errorCode: "TOKEN_MISSING",
            message: "Token fehlt in der Authorization-Header"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({
                errorCode: "TOKEN_INVALID",
                message: "Token ungültig oder abgelaufen"
            });
        }
        req.user = user;
        next();
    });
};

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

app.use("/", userRoutes);

// ➕ Person hinzufügen
app.post("/person", authenticateToken, (req, res) => {
    const person = req.body;

    const valid = validatePerson(person);
    if (!valid) {
        return res.status(400).json({
            errorCode: "INVALID_INPUT",
            message: "Falsches JSON-Format",
            errors: validatePerson.errors
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
            return res.status(400).json({
                errorCode: "DB_INSERT_ERROR",
                message: "Ungültige Eingabedaten oder Datenbankfehler"
            });
        }

        const insertedId = result.insertId;

        pool.query("SELECT * FROM personen WHERE id = ?", [insertedId], (err2, result2) => {
            if (err2) {
                console.error("Fehler beim Abrufen der eingefügten Person:", err2);
                return res.status(400).json({
                    errorCode: "DB_FETCH_ERROR",
                    message: "Person gespeichert, aber Fehler beim Abruf"
                });
            }
            res.status(201).json({ message: "Person hinzugefügt", person: result2[0] });
        });
    });
});

// ✏️ Person aktualisieren
app.put("/person/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error("Fehler beim Abrufen der Person:", err);
            return res.status(400).json({
                errorCode: "DB_READ_ERROR",
                message: "Fehlerhafte Anfrage (ID ungültig?)"
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                errorCode: "PERSON_NOT_FOUND",
                message: "Person nicht gefunden"
            });
        }

        const existingPerson = result[0];

        const person = {
            vorname: updatedData.vorname ?? existingPerson.vorname,
            nachname: updatedData.nachname ?? existingPerson.nachname,
            plz: updatedData.plz ?? existingPerson.plz,
            strasse: updatedData.strasse ?? existingPerson.strasse,
            ort: updatedData.ort ?? existingPerson.ort,
            telefonnummer: updatedData.telefonnummer ?? existingPerson.telefonnummer,
            email: updatedData.email ?? existingPerson.email
        };

        const valid = validatePerson(person);
        if (!valid) {
            return res.status(400).json({
                errorCode: "INVALID_INPUT",
                message: "Falsches JSON-Format",
                errors: validatePerson.errors
            });
        }

        const query = `
            UPDATE personen
            SET vorname = ?, nachname = ?, plz = ?, strasse = ?, ort = ?, telefonnummer = ?, email = ?
            WHERE id = ?
        `;
        const values = [
            person.vorname,
            person.nachname,
            person.plz,
            person.strasse,
            person.ort,
            person.telefonnummer,
            person.email,
            id
        ];

        pool.query(query, values, (err, result) => {
            if (err) {
                console.error("Fehler beim Aktualisieren der Person:", err);
                return res.status(400).json({
                    errorCode: "DB_UPDATE_ERROR",
                    message: "Fehlerhafte Daten oder ungültiger Updateversuch"
                });
            }

            res.status(200).json({
                message: "Person aktualisiert",
                updatedPerson: { id: Number(id), ...person }
            });
        });
    });
});

// 📋 Alle Personen abrufen
app.get("/person", authenticateToken, (req, res) => {
    pool.query("SELECT * FROM personen", (err, results) => {
        if (err) {
            return res.status(400).json({
                errorCode: "DB_FETCH_ALL_ERROR",
                message: "Fehlerhafte Anfrage beim Abrufen der Personen"
            });
        }
        res.status(200).json(results);
    });
});

// 🔍 Einzelne Person abrufen
app.get("/person/:id", authenticateToken, (req, res) => {
    const { id } = req.params;

    pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) {
            return res.status(400).json({
                errorCode: "DB_FETCH_ERROR",
                message: "Fehlerhafte Anfrage (ID ungültig?)"
            });
        }
        if (result.length === 0) {
            return res.status(404).json({
                errorCode: "PERSON_NOT_FOUND",
                message: "Person nicht gefunden"
            });
        }
        res.status(200).json(result[0]);
    });
});

// ❌ Person löschen
app.delete("/person/:id", authenticateToken, (req, res) => {
    const { id } = req.params;

    pool.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) {
            return res.status(400).json({
                errorCode: "DB_DELETE_ERROR",
                message: "Fehlerhafte Anfrage oder Löschvorgang nicht möglich"
            });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({
                errorCode: "PERSON_NOT_FOUND",
                message: "Person nicht gefunden"
            });
        }
        res.status(200).json({ message: "Person gelöscht" });
    });
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
