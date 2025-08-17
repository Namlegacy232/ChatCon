const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = new Map();   // lưu user theo socket.id
const messages = [];       // lưu toàn bộ tin nhắn
let msgCounter = 0;

app.use(express.static(path.join(__dirname, "public"))); 
// public/ chứa index.html, css, client.js

function timeNow() {
  return new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"});
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Tạo tên random cho user
  const name = "User" + Math.floor(Math.random() * 1000);
  users.set(socket.id, {name});
  socket.emit("init", { me: {id: socket.id, name}, messages });

  // Thông báo có người mới vào
  io.emit("system", `${name} đã tham gia phòng chat`);

  // Nhận tin nhắn
  socket.on("chat", (text) => {
    const user = users.get(socket.id);
    if (!user) return;
    const msg = {
      id: ++msgCounter,
      sender: socket.id,
      name: user.name,
      message: text,
      at: timeNow(),
      reactions: {}
    };
    messages.push(msg);
    io.emit("chat", msg);
  });

  // Nhận reaction
  socket.on("react", ({msgId, emoji}) => {
    const msg = messages.find(m => m.id === msgId);
    if (msg) {
      msg.reactions[socket.id] = emoji;
      io.emit("updateMsg", {id: msgId, reactions: msg.reactions});
    }
  });

  // Ngắt kết nối
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      io.emit("system", `${user.name} đã rời phòng`);
      users.delete(socket.id);
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
