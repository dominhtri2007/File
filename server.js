const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ====== FOLDER ======
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ====== DATA ======
const fileMap = {}; // id → { filename, type, time }

// ====== MIDDLEWARE ======
app.use(express.static("public"));
app.use(express.json());

// ====== UPLOAD CONFIG ======
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  // ⚡ GIỮ NGUYÊN TÊN FILE + chống trùng
  filename: (req, file, cb) => {
    let name = file.originalname;
    let filePath = path.join(uploadDir, name);

    let count = 1;

    while (fs.existsSync(filePath)) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      name = base + "_" + count + ext;
      filePath = path.join(uploadDir, name);
      count++;
    }

    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }
});

// ====== API UPLOAD ======
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;

  // tạo link random
  const id = Math.random().toString(36).substring(2, 10);

  fileMap[id] = {
    filename: file.filename,
    type: file.mimetype,
    time: new Date().toLocaleString()
  };

  const link = `${req.protocol}://${req.get("host")}/file/${id}`;

  io.emit("file", link);

  res.json({ link });
});

// ====== PREVIEW FILE ======
app.get("/file/:id", (req, res) => {
  const file = fileMap[req.params.id];
  if (!file) return res.send("File không tồn tại");

  const fileUrl = `/raw/${file.filename}`;
  const fullUrl = `${req.protocol}://${req.get("host")}${fileUrl}`;

  // dùng Google viewer nếu cần
  const viewer = `https://docs.google.com/gview?embedded=1&url=${fullUrl}`;

  res.send(`
  <html>
  <head>
    <title>Preview</title>
    <style>
      body {
        background:#0f172a;
        color:white;
        text-align:center;
        font-family:Arial;
        padding:20px;
      }

      iframe {
        width:90%;
        height:70vh;
        margin-top:20px;
        border-radius:10px;
        border:none;
      }

      button {
        margin-top:25px;
        padding:15px 30px;
        font-size:18px;
        background:#22c55e;
        border:none;
        border-radius:10px;
        color:white;
        cursor:pointer;
      }

      button:hover {
        background:#16a34a;
      }
    </style>
  </head>

  <body>

    <h2>📁 ${file.filename}</h2>

    <!-- preview -->
    <iframe src="${viewer}"></iframe>

    <p>Nếu không xem được, hãy tải xuống 👇</p>

    <!-- download -->
    <a href="/download/${file.filename}">
      <button>⬇️ Tải xuống</button>
    </a>

  </body>
  </html>
  `);
});

// ====== DOWNLOAD ======
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.send("File không tồn tại");

  res.download(filePath);
});

// ====== RAW FILE (CHO PREVIEW) ======
app.get("/raw/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.send("File không tồn tại");

  res.sendFile(filePath);
});

// ====== ADMIN ======
app.get("/admin/files", (req, res) => {
  res.json(fileMap);
});

app.delete("/admin/delete/:id", (req, res) => {
  const file = fileMap[req.params.id];
  if (!file) return res.send("Không tồn tại");

  const filePath = path.join(uploadDir, file.filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  delete fileMap[req.params.id];

  res.send("Đã xoá");
});

app.get("/admin", (req, res) => {
  res.send(`
  <html>
  <body style="background:#0f172a;color:white;font-family:Arial;padding:20px">
    <h2>📂 Quản lý file</h2>

    <table border="1" cellpadding="10">
      <thead>
        <tr>
          <th>ID</th>
          <th>File</th>
          <th>Thời gian</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody id="list"></tbody>
    </table>

    <script>
      async function load() {
        const res = await fetch('/admin/files');
        const data = await res.json();

        let html = "";
        for (let id in data) {
          const f = data[id];

          html += \`
          <tr>
            <td>\${id}</td>
            <td><a href="/file/\${id}" target="_blank">\${f.filename}</a></td>
            <td>\${f.time}</td>
            <td><button onclick="del('\${id}')">Xoá</button></td>
          </tr>\`;
        }

        document.getElementById("list").innerHTML = html;
      }

      async function del(id) {
        if (!confirm("Xoá file này?")) return;

        await fetch('/admin/delete/' + id, { method: 'DELETE' });
        load();
      }

      load();
    </script>

  </body>
  </html>
  `);
});

// ====== SOCKET ======
io.on("connection", () => {
  console.log("Client connected");
});

// ====== START ======
server.listen(PORT, () => {
  console.log("Server chạy tại:", PORT);
});