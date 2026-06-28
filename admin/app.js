const BASE_API_URL = "https://study-time-server.onrender.com";

const form = document.getElementById("uploadForm");
const statusMessage = document.getElementById("statusMessage");
const materialsList = document.getElementById("materialsList");
const refreshButton = document.getElementById("refreshButton");

const totalCount = document.getElementById("totalCount");
const pdfCount = document.getElementById("pdfCount");
const imageCount = document.getElementById("imageCount");
const videoCount = document.getElementById("videoCount");

async function loadMaterials() {
  setStatus("Loading materials...", "idle");
  try {
    const response = await fetch(BASE_API_URL + "/api/materials");
    const payload = await response.json();
    const materials = Array.isArray(payload.materials) ? payload.materials : [];
    renderSummary(materials);
    renderMaterials(materials);
    setStatus(`${materials.length} materials loaded`, "success");
  } catch (error) {
    setStatus(error.message || "Failed to load materials", "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  setStatus("Uploading to Cloudinary...", "idle");

  try {
    const response = await fetch(BASE_API_URL + "/api/materials/upload", {
      method: "POST",
      body: data
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "Upload failed");
    }

    form.reset();
    await loadMaterials();
    setStatus("Upload complete", "success");
  } catch (error) {
    setStatus(error.message || "Upload failed", "error");
  }
});

refreshButton.addEventListener("click", () => {
  loadMaterials();
});

function renderSummary(materials) {
  const summary = materials.reduce(
    (counts, item) => {
      counts.total += 1;
      if (item.type === "pdf") {
        counts.pdf += 1;
      } else if (item.type === "image") {
        counts.image += 1;
      } else if (item.type === "video") {
        counts.video += 1;
      }
      return counts;
    },
    { total: 0, pdf: 0, image: 0, video: 0 }
  );

  totalCount.textContent = summary.total;
  pdfCount.textContent = summary.pdf;
  imageCount.textContent = summary.image;
  videoCount.textContent = summary.video;
}

function renderMaterials(materials) {
  if (!materials.length) {
    materialsList.innerHTML =
      '<div class="empty-state">No study material uploaded yet.</div>';
    return;
  }

  materialsList.innerHTML = materials
    .map(
      (item) => `
        <article class="material-card">
          <div class="material-top">
            <div>
              <h3>${escapeHtml(item.title || "Untitled material")}</h3>
              <p class="material-meta">${escapeHtml(item.category || "General")} • ${formatDate(item.createdAt)}</p>
            </div>
            <span class="badge ${escapeHtml(item.type || "pdf")}">${escapeHtml(item.type || "pdf")}</span>
          </div>
          <p>${escapeHtml(item.description || "No description added.")}</p>
          <div class="material-actions">
            <span class="material-meta">${escapeHtml(item.mimeType || "file")}</span>
            <a href="${encodeURI(item.fileUrl)}" target="_blank" rel="noreferrer">Open file</a>
          </div>
        </article>
      `
    )
    .join("");
}

function setStatus(message, tone) {
  statusMessage.textContent = message;
  statusMessage.className = `status ${tone}`;
}

function formatDate(value) {
  if (!value) {
    return "Recently added";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

loadMaterials();
