const Room = require("../models/Room");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

exports.getRooms = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const publicPage = parseInt(req.query.publicPage) || 1;
    const privatePage = parseInt(req.query.privatePage) || 1;
    const sharedPage = parseInt(req.query.sharedPage) || 1;
    const limit = 4;
    const publicSkip = (publicPage - 1) * limit;
    const privateSkip = (privatePage - 1) * limit;
    const sharedSkip = (sharedPage - 1) * limit;

    // PUBLIC ROOMS

    const publicQuery = {
      isPrivate: false,
    };

    const totalPublicRooms = await Room.countDocuments(publicQuery);

    const publicRooms = await Room.find(publicQuery)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(publicSkip)
      .limit(limit);

    // PRIVATE ROOMS

    const privateQuery = {
      isPrivate: true,
      createdBy: userId,
    };

    const totalPrivateRooms = await Room.countDocuments(privateQuery);

    const privateRooms = await Room.find(privateQuery)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(privateSkip)
      .limit(limit);

    // SHARED ROOMS

    const sharedQuery = {
      isPrivate: true,
      invitedUsers: userId,
      createdBy: { $ne: userId },
    };

    const totalSharedRooms = await Room.countDocuments(sharedQuery);

    const sharedRooms = await Room.find(sharedQuery)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(sharedSkip)
      .limit(limit);

    // ALL ROOMS

    const allRooms = [...publicRooms, ...privateRooms, ...sharedRooms];

    const roomIds = allRooms.map((room) => room._id);

    // MESSAGE COUNTS

    const messageCounts = await Message.aggregate([
      {
        $match: {
          room: { $in: roomIds },
        },
      },
      {
        $group: {
          _id: "$room",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};

    messageCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const attachCounts = (rooms) =>
      rooms.map((room) => ({
        ...room.toObject(),
        messageCount: countMap[room._id.toString()] || 0,
      }));

    const publicRoomsWithCount = attachCounts(publicRooms);
    const privateRoomsWithCount = attachCounts(privateRooms);
    const sharedRoomsWithCount = attachCounts(sharedRooms);

    const user = await User.findById(userId);

    res.render("chat/rooms", {
      publicRooms: publicRoomsWithCount,
      privateRooms: privateRoomsWithCount,
      sharedRooms: sharedRoomsWithCount,
      user,
      currentUserId: userId.toString(),
      error: null,
      title: "Chat Rooms",

      // PUBLIC PAGINATION

      currentPublicPage: publicPage,
      totalPublicPages: Math.ceil(totalPublicRooms / limit),
      hasPrevPublicPage: publicPage > 1,
      hasNextPublicPage: publicPage < Math.ceil(totalPublicRooms / limit),
      prevPublicPage: publicPage - 1,
      nextPublicPage: publicPage + 1,

      // PRIVATE PAGINATION

      currentPrivatePage: privatePage,
      totalPrivatePages: Math.ceil(totalPrivateRooms / limit),
      hasPrevPrivatePage: privatePage > 1,
      hasNextPrivatePage: privatePage < Math.ceil(totalPrivateRooms / limit),
      prevPrivatePage: privatePage - 1,
      nextPrivatePage: privatePage + 1,

      // SHARED PAGINATION

      currentSharedPage: sharedPage,
      totalSharedPages: Math.ceil(totalSharedRooms / limit),
      hasPrevSharedPage: sharedPage > 1,
      hasNextSharedPage: sharedPage < Math.ceil(totalSharedRooms / limit),
      prevSharedPage: sharedPage - 1,
      nextSharedPage: sharedPage + 1,
    });
  } catch (err) {
    console.error(err);

    res.render("chat/rooms", {
      publicRooms: [],
      privateRooms: [],
      sharedRooms: [],

      user: null,
      currentUserId: null,

      error: "Failed to load rooms.",

      title: "Chat Rooms",

      // PUBLIC

      currentPublicPage: 1,
      totalPublicPages: 1,
      hasPrevPublicPage: false,
      hasNextPublicPage: false,
      prevPublicPage: null,
      nextPublicPage: null,

      // PRIVATE

      currentPrivatePage: 1,
      totalPrivatePages: 1,
      hasPrevPrivatePage: false,
      hasNextPrivatePage: false,
      prevPrivatePage: null,
      nextPrivatePage: null,

      // SHARED

      currentSharedPage: 1,
      totalSharedPages: 1,
      hasPrevSharedPage: false,
      hasNextSharedPage: false,
      prevSharedPage: null,
      nextSharedPage: null,
    });
  }
};

exports.postRoom = async (req, res) => {
  try {
    const { name, isPrivate } = req.body;

    const userId = req.session.userId;

    // Separate pagination params
    const publicPage = parseInt(req.query.publicPage) || 1;
    const privatePage = parseInt(req.query.privatePage) || 1;

    const limit = 6;

    const publicSkip = (publicPage - 1) * limit;
    const privateSkip = (privatePage - 1) * limit;

    if (!name || !name.trim()) {
      // Public rooms
      const publicQuery = {
        isPrivate: false,
      };

      const totalPublicRooms = await Room.countDocuments(publicQuery);

      const publicRooms = await Room.find(publicQuery)
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(publicSkip)
        .limit(limit);

      // Private rooms created by current user
      const privateQuery = {
        isPrivate: true,
        createdBy: userId,
      };

      const totalPrivateRooms = await Room.countDocuments(privateQuery);

      const privateRooms = await Room.find(privateQuery)
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(privateSkip)
        .limit(limit);

      // Shared rooms
      const sharedRooms = await Room.find({
        isPrivate: true,
        invitedUsers: userId,
        createdBy: { $ne: userId },
      })
        .populate("createdBy", "name")
        .sort({ createdAt: -1 });

      // Combine all rooms for message counts
      const allRooms = [...publicRooms, ...privateRooms, ...sharedRooms];
      const roomIds = allRooms.map((room) => room._id);

      const messageCounts = await Message.aggregate([
        {
          $match: {
            room: { $in: roomIds },
          },
        },
        {
          $group: {
            _id: "$room",
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = {};

      messageCounts.forEach((item) => {
        countMap[item._id.toString()] = item.count;
      });

      const attachCounts = (rooms) =>
        rooms.map((room) => ({
          ...room.toObject(),
          messageCount: countMap[room._id.toString()] || 0,
        }));

      const publicRoomsWithCount = attachCounts(publicRooms);
      const privateRoomsWithCount = attachCounts(privateRooms);
      const sharedRoomsWithCount = attachCounts(sharedRooms);

      const user = await User.findById(userId);

      return res.render("chat/rooms", {
        publicRooms: publicRoomsWithCount,
        privateRooms: privateRoomsWithCount,
        sharedRooms: sharedRoomsWithCount,
        user,
        currentUserId: userId.toString(),
        error: "Room name is required.",
        title: "Chat Rooms",

        // Public pagination
        currentPublicPage: publicPage,
        totalPublicPages: Math.ceil(totalPublicRooms / limit),
        hasPrevPublicPage: publicPage > 1,
        hasNextPublicPage: publicPage < Math.ceil(totalPublicRooms / limit),
        prevPublicPage: publicPage - 1,
        nextPublicPage: publicPage + 1,

        // Private pagination
        currentPrivatePage: privatePage,
        totalPrivatePages: Math.ceil(totalPrivateRooms / limit),
        hasPrevPrivatePage: privatePage > 1,
        hasNextPrivatePage: privatePage < Math.ceil(totalPrivateRooms / limit),
        prevPrivatePage: privatePage - 1,
        nextPrivatePage: privatePage + 1,
      });
    }

    await Room.create({
      name: name.trim(),
      createdBy: userId,
      isPrivate: isPrivate === "on",
      invitedUsers: isPrivate === "on" ? [userId] : [],
    });

    res.redirect("/chat");
  } catch (err) {
    console.error(err);
    res.redirect("/chat");
  }
};

exports.getRoom = async (req, res, next) => {
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
      room.createdBy._id.toString() !== userId &&
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

    if (!userId) {
      return res.redirect("/login");
    }

    if (!token || !token.trim()) {
      return res.status(404).send("Invalid invite link");
    }

    const room = await Room.findOne({
      inviteToken: token,
      isPrivate: true,
    });

    if (!room) {
      return res.status(404).send("Invalid invite link");
    }

    const isOwner = room.createdBy.toString() === userId.toString();
    const isAlreadyInvited =
      Array.isArray(room.invitedUsers) &&
      room.invitedUsers.some((id) => id.toString() === userId.toString());

    let added = false;

    if (!isOwner && !isAlreadyInvited) {
      await Room.updateOne(
        { _id: room._id },
        {
          $addToSet: {
            invitedUsers: userId,
          },
        },
      );

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
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }
    const users = await User.find(
      {
        _id: {
          $ne: new mongoose.Types.ObjectId(userId),
        },
      },
      "name _id",
    )
      .sort({ name: 1 })
      .lean();

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to load users",
    });
  }
};

exports.shareRoom = async (req, res) => {
  try {
    const { roomId, userIdToShare } = req.body;

    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(roomId) ||
      !mongoose.Types.ObjectId.isValid(userIdToShare)
    ) {
      return res.status(400).json({
        error: "Invalid ID",
      });
    }

    if (userId.toString() === userIdToShare.toString()) {
      return res.status(400).json({
        error: "Cannot share with yourself",
      });
    }

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (!room.isPrivate) {
      return res.status(400).json({
        error: "Only private rooms can be shared",
      });
    }

    if (room.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        error: "Not allowed",
      });
    }

    const targetUser = await User.findById(userIdToShare);

    if (!targetUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const isAlreadyInvited =
      Array.isArray(room.invitedUsers) &&
      room.invitedUsers.some(
        (id) => id.toString() === userIdToShare.toString(),
      );

    let added = false;

    if (!isAlreadyInvited) {
      await Room.updateOne(
        { _id: room._id },
        {
          $addToSet: {
            invitedUsers: userIdToShare,
          },
        },
      );

      added = true;
    }

    if (added) {
      const io = req.app.get("io");
      if (io) {
        io.to(userIdToShare.toString()).emit("roomShared", {
          roomId: room._id,
          name: room.name,
        });
      }
    }
    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to share room",
    });
  }
};
