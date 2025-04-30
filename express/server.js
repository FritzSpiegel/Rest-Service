const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const ajv = new Ajv();
addFormats(ajv); // Aktiviert Formate wie "email"

// Schema für /person PUT oder POST
const personSchema = {
    type: "object",
    properties: {
        vorname: { type: "string" },
        nachname: { type: "string" },
        plz: { type: "string" },
        strasse: { type: "string" },
        ort: { type: "string" },
        telefonnummer: { type: "string" },
        email: { type: "string", format: "email" }
    },
    required: ["vorname", "nachname", "telefonnummer", "email"],
    additionalProperties: false
};
const validatePerson = ajv.compile(personSchema);

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

app.use(express.json());

// Route: GET /hello?name=Max
app.get("/hello", (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).send("Name fehlt");

    pool.query(
        "INSERT INTO greetings (name, source) VALUES (?, ?)",
        [name, "query"],
        (err) => {
            if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
            res.send("hallo mein query ist: " + name);
        }
    );
});

// Route: GET /hello/Max
app.get("/hello/:name", (req, res) => {
    const name = req.params.name;

    pool.query(
        "INSERT INTO greetings (name, source) VALUES (?, ?)",
        [name, "param"],
        (err) => {
            if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
            res.send("hallo mein Name ist auch " + name);
        }
    );
});

// Route: POST /hello/body mit JSON
app.post("/hello/body", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send("JSON muss ein 'name'-Feld enthalten");

    pool.query(
        "INSERT INTO greetings (name, source) VALUES (?, ?)",
        [name, "body"],
        (err) => {
            if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
            res.send({ message: "Name gespeichert", name });
        }
    );
});

// POST /person mit JSON-Schema-Validierung
app.post("/person", (req, res) => {
    const person = req.body;

    const valid = validatePerson(person);
    if (!valid) {
        return res.status(400).json({
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
            return res.status(500).send("Fehler beim Speichern der Person");
        }
        res.status(201).send({ message: "Person hinzugefügt", id: result.insertId });
    });
});

// PUT /person/:id – Person aktualisieren mit JSON-Validierung
app.put("/person/:id", (req, res) => {
    const { id } = req.params;
    const person = req.body;

    const valid = validatePerson(person);
    if (!valid) {
        return res.status(400).json({
            message: "Falsches JSON-Format",
            errors: validatePerson.errors
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

// GET /person – alle Personen
app.get("/person", (req, res) => {
    pool.query("SELECT * FROM personen", (err, results) => {
        if (err) return res.status(500).send("Fehler beim Abrufen der Personen");
        res.status(200).json(results);
    });
});

// GET /person/:id – eine Person
app.get("/person/:id", (req, res) => {
    const { id } = req.params;

    pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).send("Fehler beim Abrufen der Person");
        if (result.length === 0) return res.status(404).send("Person nicht gefunden");
        res.status(200).json(result[0]);
    });
});

// DELETE /person/:id
app.delete("/person/:id", (req, res) => {
    const { id } = req.params;

    pool.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).send("Fehler beim Löschen der Person");
        if (result.affectedRows === 0) return res.status(404).send("Person nicht gefunden");
        res.status(200).send("Person gelöscht");
    });
});

app.listen(port, () => {
    console.log(`Server läuft unter http://localhost:${port}`);
});
