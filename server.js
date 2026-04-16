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

// thư mục upload
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// lưu mapping link → file thật
const fileMap = {};

// serve frontend
app.use(express.static("public"));

// cấu hình upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).substring(2, 8);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// API upload
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;

  // tạo ID random ngắn
  const shortId = Math.random().toString(36).substring(2, 10);

  // lưu mapping
  fileMap[shortId] = file.filename;

  const link = `${req.protocol}://${req.get("host")}/file/${shortId}`;

  // gửi realtime cho tất cả client
  io.emit("file", link);

  // auto xoá sau 10 phút
  setTimeout(() => {
    const filePath = path.join(uploadDir, file.filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Đã xoá:", file.filename);
    }

    delete fileMap[shortId];
  }, 10 * 60 * 1000);

  res.json({ link });
});

// download
app.get("/file/:id", (req, res) => {
  const fileName = fileMap[req.params.id];

  if (!fileName) {
    return res.status(404).send("File không tồn tại hoặc đã bị xoá");
  }

  const filePath = path.join(uploadDir, fileName);
  res.download(filePath);
});

// socket
io.on("connection", (socket) => {
  console.log("Client connected");
});

server.listen(PORT, () => {
  console.log("Server chạy tại port:", PORT);
});