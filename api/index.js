const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const pool = require("../db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Solar backend running successfully" });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).json({
      message: "Database connected successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("DB test error:", error);
    res.status(500).json({
      message: "Database connection failed",
      error: error.message
    });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { name, phone, email, title, category, message, source } = req.body;

    if (!name || !phone || !email || !title || !category || !message) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    const query = `
      INSERT INTO contact_messages
      (name, phone, email, title, category, message, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      name,
      phone,
      email,
      title,
      category,
      message,
      source || "website"
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: "Message submitted successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("POST /api/contact error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.get("/api/admin/contact-messages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contact_messages ORDER BY submitted_at DESC"
    );

    res.status(200).json({
      message: "Messages fetched successfully",
      data: result.rows
    });
  } catch (error) {
    console.error("GET /api/admin/contact-messages error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.get("/api/admin/contact-messages/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM contact_messages WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({
      message: "Message fetched successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("GET single message error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.put("/api/admin/contact-messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["new", "in_progress", "closed"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Valid status is required: new, in_progress, closed"
      });
    }

    const result = await pool.query(
      "UPDATE contact_messages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({
      message: "Message status updated successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("PUT message error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.delete("/api/admin/contact-messages/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM contact_messages WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({
      message: "Message deleted successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("DELETE message error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = app;

if (process.env.NODE_ENV !== "production") {
  const PORT = 5000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}