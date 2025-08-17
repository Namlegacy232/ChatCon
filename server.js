// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const users = new Map();         // socket.id -> { name }
const messages = [];             // lưu ~200 tin gần nhất
let msgCounter = 0;

function timeNow() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

io.on("connection", (socket) => {
  socket.on("hello", (name) => {
    users.set(socket.id, { name });

    // gửi lịch sử + online
    socket.emit("history", messages);
    io.emit("sys", { type: "join", name, at: timeNow(), online: users.size });
  });

  socket.on("chat", (text) => {
    const u = users.get(socket.id);
    if (!u) return;
    const message = (text || "").toString().slice(0, 500).trim();
    if (!message) return;
    const msg = {
      id: ++msgCounter,
      name: u.name,
      message,
      at: timeNow(),
      reactions: {},      // socketId -> emoji
      sender: socket.id
    };
    messages.push(msg);
    if (messages.length > 200) messages.shift();
    io.emit("chat", msg);
  });

  // thả cảm xúc
  socket.on("react", ({ msgId, emoji }) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    if (emoji) msg.reactions[socket.id] = emoji; else delete msg.reactions[socket.id];
    io.emit("updateMsg", { id: msgId, reactions: msg.reactions });
  });

  // --- WebRTC signaling 1–1 ---
  socket.on("webrtc-offer", ({ to, offer }) => {
    if (to) io.to(to).emit("webrtc-offer", { from: socket.id, offer });
  });
  socket.on("webrtc-answer", ({ to, answer }) => {
    if (to) io.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });
  socket.on("webrtc-candidate", ({ to, candidate }) => {
    if (to) io.to(to).emit("webrtc-candidate", { from: socket.id, candidate });
  });
  socket.on("webrtc-hangup", ({ to }) => {
    if (to) io.to(to).emit("webrtc-hangup", { from: socket.id });
  });

  socket.on("disconnect", () => {
    const u = users.get(socket.id);
    users.delete(socket.id);
    if (u) io.emit("sys", { type: "leave", name: u.name, at: timeNow(), online: users.size });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running at http://localhost:" + PORT));
