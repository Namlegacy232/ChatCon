const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const TIMEZONE_OFFSET = 7 * 60 * 60 * 1000; // GMT+7

// Lưu tin nhắn và user
let messages = [];
let users = {};

// Cấu hình upload voice
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/voices");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

app.use(express.static("public"));
app.use("/voices", express.static(path.join(__dirname, "uploads/voices")));

// API upload voice
app.post("/upload-voice", upload.single("voice"), (req, res) => {
  const filePath = `/voices/${req.file.filename}`;
  res.json({ url: filePath });
  // Xóa sau 12 tiếng
  setTimeout(() => {
    fs.unlink(path.join(__dirname, filePath), () => {});
  }, 12 * 60 * 60 * 1000);
});

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Gửi lại dữ liệu cũ cho user
  socket.emit("init", { messages, users });

  // Nhận user info
  socket.on("setUser", (data) => {
    users[socket.id] = data;
    io.emit("updateUsers", users);
  });

  // Nhận tin nhắn text
  socket.on("chatMessage", (msg) => {
    const message = {
      id: Date.now(),
      user: users[socket.id],
      text: msg,
      time: new Date(Date.now() + TIMEZONE_OFFSET).toISOString(),
      reactions: [],
    };
    messages.push(message);
    io.emit("chatMessage", message);
  });

  // Nhận voice message
  socket.on("voiceMessage", (voiceUrl) => {
    const message = {
      id: Date.now(),
      user: users[socket.id],
      voice: voiceUrl,
      time: new Date(Date.now() + TIMEZONE_OFFSET).toISOString(),
      reactions: [],
      expireAt: Date.now() + 12 * 60 * 60 * 1000
    };
    messages.push(message);
    io.emit("chatMessage", message);
  });

  // Reaction emoji
  socket.on("reactMessage", ({ msgId, emoji }) => {
    let msg = messages.find(m => m.id === msgId);
    if (msg) {
      msg.reactions.push({ user: users[socket.id], emoji });
      io.emit("updateMessage", msg);
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("updateUsers", users);
    console.log("❌ User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
