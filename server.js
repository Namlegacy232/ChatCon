// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const users = new Map(); // socket.id -> { name }
const messages = [];     // lưu tin nhắn cũ

function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

io.on("connection", (socket) => {
  socket.on("hello", (name) => {
    users.set(socket.id, { name });

    // Gửi toàn bộ tin nhắn cũ cho người mới
    socket.emit("history", messages);

    io.emit("sys", { type: "join", name, at: timeNow(), online: users.size });
  });

  socket.on("chat", (msg) => {
    const user = users.get(socket.id);
    if (!user) return;

    const trimmed = (msg || "").toString().slice(0, 500).trim();
    if (!trimmed) return;

    const chatMsg = {
      name: user.name,
      message: trimmed,
      at: timeNow(),
      id: socket.id,
    };

    messages.push(chatMsg); // lưu vào history
    if (messages.length > 100) messages.shift(); // giữ tối đa 100 tin gần nhất

    io.emit("chat", chatMsg);
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    users.delete(socket.id);
    if (user) {
      io.emit("sys", { type: "leave", name: user.name, at: timeNow(), online: users.size });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
});
