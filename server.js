const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

// Thư mục lưu voice
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use("/uploads", express.static(uploadDir));

const server = http.createServer(app);
const io = new Server(server);

let users = {};
let messages = [];

// Setup upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + ".webm")
});
const upload = multer({ storage });

app.post("/upload", upload.single("voice"), (req, res) => {
  const url = `/uploads/${req.file.filename}`;
  // Xóa sau 12h
  setTimeout(() => {
    fs.unlink(path.join(uploadDir, req.file.filename), () => {});
  }, 12 * 60 * 60 * 1000);
  res.json({ url });
});

io.on("connection", (socket) => {
  console.log("user joined:", socket.id);

  socket.on("join", (user) => {
    users[socket.id] = user;
    socket.emit("chatHistory", messages);
    io.emit("userList", Object.values(users));
  });

  socket.on("message", (msg) => {
    const data = {
      id: Date.now(),
      user: users[socket.id],
      text: msg.text || "",
      emoji: [],
      voice: msg.voice || null,
      time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    };
    messages.push(data);
    io.emit("message", data);
  });

  socket.on("react", ({ msgId, emoji }) => {
    const msg = messages.find(m => m.id === msgId);
    if (msg) msg.emoji.push(emoji);
    io.emit("updateMessage", msg);
  });

  socket.on("updateUser", (user) => {
    users[socket.id] = user;
    io.emit("userList", Object.values(users));
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
