const socket = io();
const chat = document.getElementById("chat");
const msgInput = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const searchInput = document.getElementById("search");
const recordBtn = document.getElementById("record");

const usernameInput = document.getElementById("username");
const avatarUpload = document.getElementById("avatarUpload");
const avatarPreview = document.getElementById("avatarPreview");
const saveUserBtn = document.getElementById("saveUser");

let user = JSON.parse(localStorage.getItem("user")) || {
  name: "Ẩn danh",
  avatar: "https://i.pravatar.cc/100"
};

usernameInput.value = user.name;
avatarPreview.src = user.avatar;

// Gửi user info lên server
function saveUser() {
  user.name = usernameInput.value;
  localStorage.setItem("user", JSON.stringify(user));
  socket.emit("setUser", user);
}
saveUser();

saveUserBtn.onclick = saveUser;

avatarUpload.onchange = e => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      user.avatar = reader.result;
      avatarPreview.src = user.avatar;
    };
    reader.readAsDataURL(file);
  }
};

// Hiển thị tin nhắn
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "message " + (msg.user.name === user.name ? "self" : "other");

  let content = `<b><img src="${msg.user.avatar}" style="width:20px;border-radius:50%"> ${msg.user.name}</b><br>`;
  if (msg.text) content += msg.text;
  if (msg.voice) content += `<br><audio controls src="${msg.voice}"></audio>`;
  if (msg.reactions.length)
    content += `<div class="reactions">${msg.reactions.map(r => r.emoji).join(" ")}</div>`;

  div.innerHTML = content;
  div.onclick = () => {
    let emoji = prompt("Thả emoji:");
    if (emoji) socket.emit("reactMessage", { msgId: msg.id, emoji });
  };
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// Nhận dữ liệu
socket.on("init", data => {
  chat.innerHTML = "";
  data.messages.forEach(renderMessage);
});

socket.on("chatMessage", renderMessage);

socket.on("updateMessage", msg => {
  chat.innerHTML = "";
  messages.forEach(renderMessage);
});

// Gửi tin nhắn text
sendBtn.onclick = () => {
  if (msgInput.value.trim()) {
    socket.emit("chatMessage", msgInput.value);
    msgInput.value = "";
  }
};

// Tìm kiếm
searchInput.oninput = () => {
  const q = searchInput.value.toLowerCase();
  [...chat.children].forEach(c => {
    c.style.display = c.innerText.toLowerCase().includes(q) ? "block" : "none";
  });
};

// 🎤 Ghi âm
let mediaRecorder;
recordBtn.onclick = async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    let chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("voice", blob, "voice.webm");
      const res = await fetch("/upload-voice", { method: "POST", body: formData });
      const data = await res.json();
      socket.emit("voiceMessage", data.url);
    };
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 60000); // 1 phút
    alert("🎙️ Đang ghi âm...");
  } else {
    mediaRecorder.stop();
    alert("✅ Đã gửi ghi âm!");
  }
};
