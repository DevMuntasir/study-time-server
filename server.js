const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT || 4000);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "materials.json");
const adminDir = path.join(__dirname, "..", "admin");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(cors());
app.use(express.json());
app.use("/admin", express.static(adminDir));

app.get("/", (_request, response) => {
  response.redirect("/admin/");
});

app.get("/api/health", async (_request, response) => {
  const materials = await readMaterials();
  response.json({
    app: "Study Time",
    status: "ok",
    materials: materials.length
  });
});

app.get("/api/materials", async (_request, response) => {
  const materials = await readMaterials();
  response.json({ materials });
});

app.post("/api/materials/upload", upload.single("file"), async (request, response) => {
  try {
    if (!hasCloudinaryConfig()) {
      response.status(500).json({
        message: "Missing Cloudinary configuration. Update backend/.env first."
      });
      return;
    }

    if (!request.file) {
      response.status(400).json({ message: "A file is required." });
      return;
    }

    const type = resolveMaterialType(request.file.mimetype);
    const result = await uploadToCloudinary(request.file, type);

    const material = {
      id: crypto.randomUUID(),
      title: cleanText(request.body.title) || fallbackTitle(request.file.originalname),
      description: cleanText(request.body.description),
      category: cleanText(request.body.category) || "General",
      type,
      mimeType: request.file.mimetype,
      fileUrl: result.secure_url,
      publicId: result.public_id,
      createdAt: new Date().toISOString()
    };

    const materials = await readMaterials();
    materials.unshift(material);
    await writeMaterials(materials);

    response.status(201).json({
      message: "Material uploaded successfully.",
      material
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    response.status(statusCode).json({
      message: error.message || "Upload failed."
    });
  }
});

async function readMaterials() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const materials = JSON.parse(raw);
  return Array.isArray(materials) ? materials : [];
}

async function writeMaterials(materials) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(materials, null, 2), "utf8");
}

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch (_error) {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function resolveMaterialType(mimeType) {
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType && mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType && mimeType.startsWith("video/")) {
    return "video";
  }

  const error = new Error("Only PDF, image, and video files are supported.");
  error.statusCode = 400;
  throw error;
}

function uploadToCloudinary(file, type) {
  const resourceType = type === "pdf" ? "raw" : type;
  const slug = slugify(path.parse(file.originalname).name || "study-material");
  const publicId =
    type === "pdf"
      ? `${Date.now()}-${slug}.pdf`
      : `${Date.now()}-${slug}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: `study-time/${type}`,
        public_id: publicId,
        overwrite: false
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed."));
          return;
        }
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

function fallbackTitle(filename) {
  return path
    .parse(filename)
    .name
    .replace(/[-_]+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "").trim();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "study-material";
}

app.listen(port, () => {
  console.log(`Study Time backend running on http://localhost:${port}`);
});
