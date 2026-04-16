const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const archiver = require("archiver");
const { getFullInfo } = require("./pc");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== FOLDER =====
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
// info
app.get("/api/info", async (req, res) => {
  const data = await getFullInfo();
  res.json(data);
});
app.get("/info", (req, res) => {
  res.send(`
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Server Info</title>

    <style>
      body {
        background:#0f172a;
        color:white;
        font-family:Arial;
        padding:30px;
        text-align:center;
      }

      .box {
        background:#1e293b;
        padding:20px;
        border-radius:10px;
        width:600px;
        margin:auto;
        text-align:left;
      }

      h2 {
        text-align:center;
      }
    </style>
  </head>

  <body>

    <div class="box">
      <h2>📊 SERVER INFO</h2>

      <p id="cpu"></p>
      <p id="ram"></p>
      <p id="disk"></p>
      <p id="os"></p>
      <p id="uptime"></p>
    </div>

    <script>
      async function load() {
        const res = await fetch('/api/info');
        const data = await res.json();

        document.getElementById("cpu").innerText =
          "CPU: " + data.cpu.name +
          " | " + data.cpu.cores + " cores | " +
          data.cpu.usage + "%";

        document.getElementById("ram").innerText =
          "RAM: " + data.ram.used + "/" + data.ram.total +
          " GB | slots: " + data.ram.slots;

        document.getElementById("disk").innerText =
          "Disk: " + data.disk.map(d =>
            d.name + " (" + d.used + "/" + d.total + "GB)"
          ).join(" | ");

        document.getElementById("os").innerText =
          "OS: " + data.os.distro + " (" + data.os.arch + ")";

        document.getElementById("uptime").innerText =
          "Uptime: " + data.uptime;
      }

      setInterval(load, 2000);
      load();
    </script>

  </body>
  </html>
  `);
});
// ===== DATA =====
const fileMap = {};

// ===== STATIC =====
app.use(express.static("public"));
app.use("/raw", express.static(uploadDir));
app.use(express.json());

// ===== MULTER =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  filename: (req, file, cb) => {
    const name = Buffer.from(file.originalname, "latin1").toString("utf8");

    let finalName = name;
    let filePath = path.join(uploadDir, finalName);
    let count = 1;

    while (fs.existsSync(filePath)) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      finalName = base + "_" + count + ext;
      filePath = path.join(uploadDir, finalName);
      count++;
    }

    cb(null, finalName);
  }
});

const upload = multer({ storage });

// ===== UPLOAD =====
app.post("/upload", upload.array("file"), (req, res) => {
  const files = req.files;
  const id = Math.random().toString(36).substring(2, 10);

  fileMap[id] = {
    files: files.map(f => f.filename),
    types: files.map(f => f.mimetype),
    original: files.map(f => f.originalname)
  };

  const link = `${req.protocol}://${req.get("host")}/file/${id}`;
  io.emit("file", link);

  res.json({ link });
});

// ===== DOWNLOAD ZIP =====
app.get("/download-zip/:id", (req, res) => {
  const data = fileMap[req.params.id];
  if (!data) return res.send("Không tồn tại");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=files.zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  data.files.forEach((file, i) => {
    archive.file(path.join(uploadDir, file), {
      name: data.original[i]
    });
  });

  archive.finalize();
});

// ===== DOWNLOAD SINGLE =====
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.send("Không tồn tại");

  res.download(filePath);
});

// ===== PREVIEW =====
app.get("/file/:id", (req, res) => {
  const data = fileMap[req.params.id];
  if (!data) return res.send("Không tồn tại");

  // 👉 MULTIPLE FILE
  if (data.files.length > 1) {
    return res.send(`
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="background:#0f172a;color:white;text-align:center">

      <h2>📦 ${data.files.length} files</h2>

      <a href="/download-zip/${req.params.id}">
        <button style="padding:15px 30px;font-size:18px">
          ⬇️ Tải tất cả (ZIP)
        </button>
      </a>

    </body>
    </html>
    `);
  }

  // 👉 SINGLE FILE
  const file = data.files[0];
  const type = data.types[0];
  const url = `/raw/${file}`;

  let preview = "";

  if (type.startsWith("image")) {
    preview = `<img src="${url}" style="max-width:90%">`;
  } else if (type.startsWith("video")) {
    preview = `<video controls src="${url}" style="max-width:90%"></video>`;
  } else if (type.startsWith("audio")) {
    preview = `<audio controls src="${url}" style="width:80%"></audio>`;
  } else if (type === "application/pdf") {
    preview = `<iframe src="${url}" style="width:90%;height:70vh"></iframe>`;
  } else {
    preview = `<p>❌ Không preview được</p>`;
  }

  res.send(`
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="background:#0f172a;color:white;text-align:center">

    <h2>📁 ${file}</h2>

    ${preview}

    <br>

    <a href="/download/${file}">
      <button style="padding:15px 30px;font-size:18px">
        ⬇️ Tải xuống
      </button>
    </a>

  </body>
  </html>
  `);
});

// ===== SOCKET =====
io.on("connection", () => {
  console.log("Client connected");
});

// ===== START =====
server.listen(PORT, () => {
  console.log("Server chạy:", PORT);
});