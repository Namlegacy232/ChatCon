const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

function timeNow(){
  return new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});
}

let msgCounter=0;
const messages=[];
const users=new Map();

io.on("connection",socket=>{
  users.set(socket.id,{name:"User"+Math.floor(Math.random()*1000)});
  socket.emit("history",messages);

  socket.on("chat",text=>{
    const user=users.get(socket.id);
    if(!user) return;
    const msg={
      id:++msgCounter,
      name:user.name,
      message:text,
      at:timeNow(),
      reactions:{},
      sender:socket.id
    };
    messages.push(msg);
    io.emit("chat",msg);
  });

  socket.on("react",({msgId,emoji})=>{
    const msg=messages.find(m=>m.id===msgId);
    if(msg){
      msg.reactions[socket.id]=emoji;
      io.emit("updateMsg",{id:msgId,reactions:msg.reactions});
    }
  });

  socket.on("disconnect",()=>users.delete(socket.id));
});

http.listen(3000,()=>console.log("Server chạy ở http://localhost:3000"));
