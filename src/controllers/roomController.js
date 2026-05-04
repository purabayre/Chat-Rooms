const Room = require("../models/Room");
const Message = require("../models/Message");
const User = require("../models/User");

exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    const roomsWithCount = await Promise.all(
      rooms.map(async (room) => {
        const messageCount = await Message.countDocuments({ room: room._id });
        return { ...room.toObject(), messageCount };
      }),
    );

    const user = await User.findById(req.session.userId);
    res.render("chat/rooms", {
      rooms: roomsWithCount,
      user,
      error: null,
      title: "Chat Rooms",
    });
  } catch (err) {
    console.error(err);
    res.render("chat/rooms", {
      rooms: [],
      user: null,
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
        error: "Room name is required.",
        title: "Chat Rooms",
      });
    }

    const room = await Room.create({
      name: name.trim(),
      createdBy: req.session.userId,
      isPrivate: isPrivate === "on",
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
    if (!room) return res.status(404).render("404", { title: "Not Found" });

    if (room.isPrivate) {
      const token = req.query.token;
      if (!token || token !== room.inviteToken) {
        return res.status(403).render("403", { title: "Access Denied" });
      }
    }

    const messages = await Message.find({ room: room._id })
      .populate("sender", "name avatarPath")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    messages.reverse();

    const user = await User.findById(req.session.userId);
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
