const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const db = new sqlite3.Database("./bookings.db");

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    venue TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    seat_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    UNIQUE(event_id, seat_number),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
  )`);
});

app.get("/api/events", (req, res) => {
  db.all("SELECT * FROM events ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/events/:id/seats", (req, res) => {
  db.all(
    "SELECT * FROM seats WHERE event_id = ? ORDER BY seat_number ASC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/events", (req, res) => {
  const { name, event_date, venue, seats } = req.body;
  if (!name || !event_date || !venue) {
    return res.status(400).json({ error: "Missing event fields" });
  }

  db.run(
    "INSERT INTO events (name, event_date, venue) VALUES (?, ?, ?)",
    [name, event_date, venue],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const eventId = this.lastID;
      const seatList = Array.isArray(seats) ? seats : [];

      if (seatList.length === 0) {
        return res.json({ success: true, event_id: eventId });
      }

      let done = 0;
      seatList.forEach((seatNumber) => {
        db.run(
          "INSERT INTO seats (event_id, seat_number) VALUES (?, ?)",
          [eventId, seatNumber],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            done++;
            if (done === seatList.length) {
              res.json({ success: true, event_id: eventId });
            }
          }
        );
      });
    }
  );
});

app.post("/api/book", (req, res) => {
  const { event_id, seat_id, customer_name, customer_phone } = req.body;

  if (!event_id || !seat_id || !customer_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.get(
    "SELECT status FROM seats WHERE id = ? AND event_id = ?",
    [seat_id, event_id],
    (err, seat) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!seat) return res.status(404).json({ error: "Seat not found" });
      if (seat.status === "booked") {
        return res.status(400).json({ error: "Seat already booked" });
      }

      db.run(
        "INSERT INTO bookings (event_id, seat_id, customer_name, customer_phone) VALUES (?, ?, ?, ?)",
        [event_id, seat_id, customer_name, customer_phone || null],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          db.run(
            "UPDATE seats SET status = 'booked' WHERE id = ?",
            [seat_id],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ success: true, booking_id: this.lastID });
            }
          );
        }
      );
    }
  );
});

app.get("/api/seed", (req, res) => {
  db.get("SELECT COUNT(*) AS count FROM events", [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row.count > 0) {
      return res.json({ success: true, message: "Sample data already exists" });
    }

    db.run(
      "INSERT INTO events (name, event_date, venue) VALUES (?, ?, ?)",
      ["Concert Night", "2026-08-15", "Main Hall"],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const eventId = this.lastID;
        const seats = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"];

        let done = 0;
        seats.forEach((seat) => {
          db.run(
            "INSERT INTO seats (event_id, seat_number) VALUES (?, ?)",
            [eventId, seat],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              done++;
              if (done === seats.length) {
                res.json({ success: true, message: "Sample data inserted" });
              }
            }
          );
        });
      }
    );
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
