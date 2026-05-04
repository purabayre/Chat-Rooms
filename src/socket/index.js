const socketSession = require("express-socket.io-session");
const Message = require("../models/Message");
const User = require("../models/User");
const sanitizeHtml = require("sanitize-html");

const roomMembers = new Map();

function getRoomUsers(roomId) {
  return roomMembers.has(roomId)
    ? [...roomMembers.get(roomId).values()].map((m) => m.userName)
    : [];
}

function addMember(roomId, info) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());
  roomMembers.get(roomId).set(info.socketId, info);
}

function removeMember(roomId, socketId) {
  if (!roomMembers.has(roomId)) return;

  const map = roomMembers.get(roomId);
  map.delete(socketId);

  if (map.size === 0) roomMembers.delete(roomId);
}

function findUserByName(roomId, name) {
  if (!roomMembers.has(roomId)) return null;

  for (const member of roomMembers.get(roomId).values()) {
    if (member.userName.toLowerCase() === name.toLowerCase()) {
      return member;
    }
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

    socket.on("join-room", async ({ roomId, before }) => {
      if (!roomId) return;

      socket.join(roomId);
      currentRooms.add(roomId);

      addMember(roomId, {
        socketId: socket.id,
        userId,
        userName: currentUser.name,
        avatarPath: currentUser.avatarPath,
      });

      try {
        const query = { room: roomId };

        if (before) {
          query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
          .populate("sender", "name avatarPath")
          .sort({ createdAt: -1 })
          .limit(50);

        const cleanMessages = messages.map((m) => {
          const obj = m.toObject();

          if (!obj.reactions) {
            obj.reactions = {};
          } else if (obj.reactions instanceof Map) {
            obj.reactions = Object.fromEntries(obj.reactions);
          }

          return obj;
        });

        cleanMessages.reverse();

        socket.emit("room-history", {
          messages: cleanMessages,
          hasMore: messages.length === 50,
          nextBefore: messages.length
            ? messages[messages.length - 1].createdAt
            : null,
        });
      } catch (err) {
        console.error("history error", err);
      }

      socket.to(roomId).emit("user-joined", { name: currentUser.name });
      io.to(roomId).emit("online-users", getRoomUsers(roomId));
    });

    socket.on("load-older-messages", async ({ roomId, before }) => {
      if (!roomId || !before) return;

      try {
        const query = {
          room: roomId,
          createdAt: { $lt: new Date(before) },
        };

        const messages = await Message.find(query)
          .populate("sender", "name avatarPath")
          .sort({ createdAt: -1 })
          .limit(50);

        const hasMore = messages.length === 50;

        const trimmedMessages = messages.slice(0, 50);

        const cleanMessages = trimmedMessages.map((m) => {
          const obj = m.toObject();

          if (!obj.reactions) {
            obj.reactions = {};
          } else if (obj.reactions instanceof Map) {
            obj.reactions = Object.fromEntries(obj.reactions);
          }

          return obj;
        });

        cleanMessages.reverse();

        socket.emit("older-messages", {
          messages: cleanMessages,
          hasMore,
          nextBefore: trimmedMessages.length
            ? trimmedMessages[trimmedMessages.length - 1].createdAt
            : null,
        });
      } catch (err) {
        console.error("load older messages error:", err);
      }
    });

    socket.on("send-message", async ({ roomId, text }) => {
      if (!roomId || !text) return;

      const clean = sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();

      if (!clean) return;

      try {
        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        let match;
        const mentionedUsersMap = new Map(); // prevent duplicates

        while ((match = mentionRegex.exec(clean)) !== null) {
          const username = match[1];
          const user = findUserByName(roomId, username);

          if (user) {
            mentionedUsersMap.set(user.userId.toString(), user);
          }
        }

        const mentionedUsers = [...mentionedUsersMap.values()];

        const message = await Message.create({
          room: roomId,
          sender: userId,
          text: clean,
          reactions: new Map(),
        });

        const populated = await message.populate("sender", "name avatarPath");

        io.to(roomId).emit("new-message", {
          _id: populated._id,
          sender: populated.sender,
          text: populated.text,
          reactions: {},
          createdAt: populated.createdAt,
        });

        for (const user of mentionedUsers) {
          io.to(user.socketId).emit("mention-notification", {
            roomId,
            message: clean,
            from: currentUser.name,
          });
        }
      } catch (err) {
        console.error("message error", err);
      }
    });

    socket.on("react-message", async ({ messageId, emoji }) => {
      if (!messageId || !emoji) return;

      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;

        if (!msg.reactions) {
          msg.reactions = new Map();
        }

        const userIdStr = userId.toString();

        let users = msg.reactions.get(emoji);

        if (!Array.isArray(users)) {
          users = [];
        }

        const index = users.indexOf(userIdStr);

        if (index > -1) {
          users.splice(index, 1);
        } else {
          users.push(userIdStr);
        }

        if (users.length === 0) {
          msg.reactions.delete(emoji);
        } else {
          msg.reactions.set(emoji, users);
        }

        await msg.save();

        const formattedReactions = Object.fromEntries(msg.reactions || []);

        io.to(msg.room.toString()).emit("message-reaction-updated", {
          messageId,
          reactions: formattedReactions,
        });
      } catch (err) {
        console.error("reaction error:", err);
      }
    });

    socket.on("typing", ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit("typing", { name: currentUser.name });
    });

    socket.on("stop-typing", ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit("stop-typing", { name: currentUser.name });
    });

    socket.on("leave-room", ({ roomId }) => {
      if (!roomId) return;
      handleLeave(roomId);
    });

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
