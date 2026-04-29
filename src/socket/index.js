const socketSession = require("express-socket.io-session");
const Message = require("../models/Message");
const User = require("../models/User");
const sanitizeHtml = require("sanitize-html");

// roomId -> Set of { socketId, userId, userName, avatarPath }
const roomMembers = new Map();

function getRoomUsers(roomId) {
  return roomMembers.has(roomId)
    ? [...roomMembers.get(roomId)].map((m) => m.userName)
    : [];
}

function addMember(roomId, info) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
  roomMembers.get(roomId).add(info);
}

function removeMember(roomId, socketId) {
  if (!roomMembers.has(roomId)) return;
  const set = roomMembers.get(roomId);
  for (const m of set) {
    if (m.socketId === socketId) {
      set.delete(m);
      break;
    }
  }
  if (set.size === 0) roomMembers.delete(roomId);
}

function findMember(roomId, socketId) {
  if (!roomMembers.has(roomId)) return null;
  for (const m of roomMembers.get(roomId)) {
    if (m.socketId === socketId) return m;
  }
  return null;
}

module.exports = (io, session) => {
  io.use(socketSession(session, { autoSave: true }));

  io.use((socket, next) => {
    const sess = socket.handshake.session;
    if (!sess || !sess.userId) {
      return next(new Error("Unauthorized"));
    }
    next();
  });

  io.on("connection", async (socket) => {
    const sess = socket.handshake.session;
    const userId = sess.userId;
    let currentRooms = new Set();

    let currentUser;
    try {
      currentUser = await User.findById(userId).lean();
    } catch {
      socket.disconnect(true);
      return;
    }

    // ── join-room ──────────────────────────────────────────────
    socket.on("join-room", async ({ roomId }) => {
      if (!roomId) return;

      socket.join(roomId);
      currentRooms.add(roomId);

      const memberInfo = {
        socketId: socket.id,
        userId,
        userName: currentUser.name,
        avatarPath: currentUser.avatarPath,
      };
      addMember(roomId, memberInfo);

      // send history
      try {
        const messages = await Message.find({ room: roomId })
          .populate("sender", "name avatarPath")
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        messages.reverse();
        socket.emit("room-history", messages);
      } catch (err) {
        console.error("history error", err);
      }

      socket.to(roomId).emit("user-joined", { name: currentUser.name });
      io.to(roomId).emit("online-users", getRoomUsers(roomId));
    });

    // ── send-message ───────────────────────────────────────────
    socket.on("send-message", async ({ roomId, text }) => {
      if (!roomId || !text) return;

      const clean = sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();
      if (!clean) return;

      try {
        const message = await Message.create({
          room: roomId,
          sender: userId,
          text: clean,
        });
        const populated = await message.populate("sender", "name avatarPath");

        io.to(roomId).emit("new-message", {
          _id: populated._id,
          sender: populated.sender,
          text: populated.text,
          createdAt: populated.createdAt,
        });
      } catch (err) {
        console.error("message error", err);
      }
    });

    // ── typing indicators ──────────────────────────────────────
    socket.on("typing", ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit("typing", { name: currentUser.name });
    });

    socket.on("stop-typing", ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit("stop-typing", { name: currentUser.name });
    });

    // ── leave-room ─────────────────────────────────────────────
    socket.on("leave-room", ({ roomId }) => {
      if (!roomId) return;
      handleLeave(roomId);
    });

    // ── disconnect ─────────────────────────────────────────────
    socket.on("disconnect", () => {
      for (const roomId of currentRooms) {
        handleLeave(roomId);
      }
    });

    function handleLeave(roomId) {
      socket.leave(roomId);
      currentRooms.delete(roomId);
      removeMember(roomId, socket.id);
      socket.to(roomId).emit("user-left", { name: currentUser.name });
      io.to(roomId).emit("online-users", getRoomUsers(roomId));
    }
  });
};
