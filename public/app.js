const socket = io();
let xhr;

// ===== SOCKET =====
socket.on("file", (link) => {

  document.getElementById("result").innerHTML = `
    <div class="linkBox">
      <span>${link}</span>
      <button class="copyBtn" onclick="copyLink('${link}')">📋 Copy</button>
    </div>
  `;

  QRCode.toCanvas(document.getElementById("qr"), link, { width: 200 });
});

// ===== DRAG DROP =====
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.onclick = () => fileInput.click();

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadFiles(e.dataTransfer.files);
});

fileInput.onchange = () => {
  uploadFiles(fileInput.files);
};

// ===== UPLOAD =====
function uploadFiles(files) {
  if (!files.length) return;

  document.getElementById("topBar").style.display = "flex";
  document.getElementById("fileBox").style.display = "block";

  document.getElementById("queue").innerText = files.length + " files";

  let totalSize = 0;
  for (let i = 0; i < files.length; i++) totalSize += files[i].size;

  document.getElementById("fileName").innerText =
    files.length === 1 ? files[0].name : "📦 Multiple files";

  document.getElementById("fileSize").innerText =
    (totalSize / 1024 / 1024).toFixed(2) + " MB";

  xhr = new XMLHttpRequest();
  const formData = new FormData();

  for (let i = 0; i < files.length; i++) {
    formData.append("file", files[i]);
  }

  xhr.open("POST", "/upload");

  let startTime = Date.now();

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {

      const percent = (e.loaded / e.total) * 100;

      document.getElementById("bar").style.width = percent + "%";
      document.getElementById("percent").innerText = Math.round(percent) + "%";
      document.getElementById("percent2").innerText = Math.round(percent);

      const duration = (Date.now() - startTime) / 1000;
      const speed = (e.loaded / 1024 / duration).toFixed(1);

      document.getElementById("speed").innerText = speed + " KB/s";
      document.getElementById("speed2").innerText = speed;

      const remaining =
        ((e.total - e.loaded) / (e.loaded / duration)).toFixed(0);

      document.getElementById("time").innerText = remaining + "s";
      document.getElementById("time2").innerText = remaining;
    }
  };

  xhr.onload = () => {
    document.getElementById("result").innerHTML += "<br>✅ Upload xong!";
  };

  xhr.send(formData);
}

// ===== COPY =====
function copyLink(link) {
  navigator.clipboard.writeText(link);
  alert("Đã copy!");
}

// ===== CANCEL =====
function cancelUpload() {
  if (xhr) {
    xhr.abort();
    document.getElementById("result").innerText = "❌ Đã huỷ";
  }
}