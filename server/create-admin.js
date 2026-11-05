require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User } = require("./models");

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const email = "kutubuddin@gmail.com";
    const password = "kutub017845";

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "admin"
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log("Admin তৈরি হয়েছে:", user.email);

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();