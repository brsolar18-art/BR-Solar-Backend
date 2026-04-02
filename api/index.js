const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");

dotenv.config();

const pool = require("../db");
const cloudinary = require("../cloudinary");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

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

const uploadToCloudinary = (fileBuffer, folderName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(fileBuffer);
  });
};

app.post("/api/admin/projects", upload.fields([
  { name: "image_1", maxCount: 1 },
  { name: "image_2", maxCount: 1 },
  { name: "image_3", maxCount: 1 }
]), async (req, res) => {
  try {
    const { client_name, installation_location, project_description } = req.body;

    if (!client_name || !installation_location || !project_description) {
      return res.status(400).json({
        message: "Client name, installation location and project description are required"
      });
    }

    if (
      !req.files ||
      !req.files.image_1 ||
      !req.files.image_2 ||
      !req.files.image_3
    ) {
      return res.status(400).json({
        message: "All 3 images are required"
      });
    }

    const image1Upload = await uploadToCloudinary(req.files.image_1[0].buffer, "br-solar-projects");
    const image2Upload = await uploadToCloudinary(req.files.image_2[0].buffer, "br-solar-projects");
    const image3Upload = await uploadToCloudinary(req.files.image_3[0].buffer, "br-solar-projects");

    const query = `
      INSERT INTO client_projects
      (client_name, installation_location, project_description, image_1, image_2, image_3)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      client_name,
      installation_location,
      project_description,
      image1Upload.secure_url,
      image2Upload.secure_url,
      image3Upload.secure_url
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: "Project created successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("POST /api/admin/projects error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM client_projects ORDER BY created_at DESC"
    );

    res.status(200).json({
      message: "Projects fetched successfully",
      data: result.rows
    });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.get("/api/admin/projects", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM client_projects ORDER BY created_at DESC"
    );

    res.status(200).json({
      message: "Admin projects fetched successfully",
      data: result.rows
    });
  } catch (error) {
    console.error("GET /api/admin/projects error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.get("/api/admin/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM client_projects WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Project fetched successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("GET /api/admin/projects/:id error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.put("/api/admin/projects/:id", upload.fields([
  { name: "image_1", maxCount: 1 },
  { name: "image_2", maxCount: 1 },
  { name: "image_3", maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const { client_name, installation_location, project_description } = req.body;

    const existingProject = await pool.query(
      "SELECT * FROM client_projects WHERE id = $1",
      [id]
    );

    if (existingProject.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    let image1 = existingProject.rows[0].image_1;
    let image2 = existingProject.rows[0].image_2;
    let image3 = existingProject.rows[0].image_3;

    if (req.files?.image_1?.[0]) {
      const uploaded = await uploadToCloudinary(req.files.image_1[0].buffer, "br-solar-projects");
      image1 = uploaded.secure_url;
    }

    if (req.files?.image_2?.[0]) {
      const uploaded = await uploadToCloudinary(req.files.image_2[0].buffer, "br-solar-projects");
      image2 = uploaded.secure_url;
    }

    if (req.files?.image_3?.[0]) {
      const uploaded = await uploadToCloudinary(req.files.image_3[0].buffer, "br-solar-projects");
      image3 = uploaded.secure_url;
    }

    const result = await pool.query(
      `UPDATE client_projects
       SET client_name = $1,
           installation_location = $2,
           project_description = $3,
           image_1 = $4,
           image_2 = $5,
           image_3 = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        client_name || existingProject.rows[0].client_name,
        installation_location || existingProject.rows[0].installation_location,
        project_description || existingProject.rows[0].project_description,
        image1,
        image2,
        image3,
        id
      ]
    );

    res.status(200).json({
      message: "Project updated successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("PUT /api/admin/projects/:id error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

app.delete("/api/admin/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM client_projects WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Project deleted successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("DELETE /api/admin/projects/:id error:", error);
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