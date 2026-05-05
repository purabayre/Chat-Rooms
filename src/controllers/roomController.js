const Room = require("../models/Room");
const Message = require("../models/Message");
const User = require("../models/User");

exports.getRooms = async (req, res) => {
  try {
    const userId = req.session.userId;

    const rooms = await Room.find({
      $or: [
        { isPrivate: false },
        { createdBy: userId },
        { invitedUsers: userId },
      ],
    })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    const roomsWithCount = await Promise.all(
      rooms.map(async (room) => {
        const messageCount = await Message.countDocuments({
          room: room._id,
        });
        return { ...room.toObject(), messageCount };
      }),
    );

    const user = await User.findById(userId);

    res.render("chat/rooms", {
      rooms: roomsWithCount,
      user,
      currentUserId: userId.toString(),
      error: null,
      title: "Chat Rooms",
    });
  } catch (err) {
    console.error(err);
    res.render("chat/rooms", {
      rooms: [],
      user: null,
      currentUserId: null,
      error: "Failed to load rooms.",
      title: "Chat Rooms",
    });
  }
};

exports.postRoom = async (req, res) => {
  try {
    const { name, isPrivate } = req.body;

    if (!name || !name.trim()) {
      const rooms = await Room.find()
        .populate("createdBy", "name")
        .sort({ createdAt: -1 });

      const user = await User.findById(req.session.userId);

      return res.render("chat/rooms", {
        rooms,
        user,
        currentUserId: req.session.userId.toString(),
        error: "Room name is required.",
        title: "Chat Rooms",
      });
    }

    const room = await Room.create({
      name: name.trim(),
      createdBy: req.session.userId,
      isPrivate: isPrivate === "on",

      invitedUsers: isPrivate === "on" ? [req.session.userId] : [],
    });

    res.redirect(`/chat`);
  } catch (err) {
    console.error(err);
    res.redirect("/chat");
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate(
      "createdBy",
      "name",
    );

    if (!room) {
      return res.status(404).render("404", { title: "Not Found" });
    }

    const userId = req.session.userId;

    if (
      room.isPrivate &&
      room.createdBy.toString() !== userId &&
      !room.invitedUsers.some((id) => id.toString() === userId.toString())
    ) {
      return res.status(403).render("403", { title: "Access Denied" });
    }

    const messages = await Message.find({ room: room._id })
      .populate("sender", "name avatarPath")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    messages.reverse();

    const user = await User.findById(userId);

    res.render("chat/room", {
      room,
      messages,
      user,
      title: room.name,
      inviteToken: room.isPrivate ? room.inviteToken : null,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/chat");
  }
};

exports.joinByInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.session.userId;

    const room = await Room.findOne({ inviteToken: token });

    if (!room) {
      return res.status(404).send("Invalid invite link");
    }

    let added = false;

    if (!room.invitedUsers.some((id) => id.toString() === userId.toString())) {
      room.invitedUsers.push(userId);
      await room.save();
      added = true;
    }
    if (added) {
      const io = req.app.get("io");

      if (io) {
        io.to(userId.toString()).emit("roomShared", {
          roomId: room._id,
          name: room.name,
        });
      }
    }

    res.redirect(`/chat/rooms/${room._id}`);
  } catch (err) {
    console.error(err);
    res.redirect("/chat");
  }
};
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.session.userId } },
      "name _id",
    ).lean();

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
};
exports.shareRoom = async (req, res) => {
  try {
    const { roomId, userIdToShare } = req.body;
    const userId = req.session.userId;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (!room.invitedUsers.some((id) => id.toString() === userIdToShare)) {
      room.invitedUsers.push(userIdToShare);
      await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(userIdToShare).emit("roomShared", {
        roomId: room._id,
        name: room.name,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to share room" });
  }
};
