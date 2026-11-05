// ব্যবহার: npm run seed -- ইমেইল পাসওয়ার্ড [admin|viewer]
require("dotenv").config();
const mongoose = require("mongoose"), bcrypt = require("bcryptjs");
const { User } = require("./models");
(async () => {
  const [email, password, role = "admin"] = process.argv.slice(2);
  if (!email || !password) { console.log("ব্যবহার: npm run seed -- ইমেইল পাসওয়ার্ড [admin|viewer]"); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  await User.findOneAndUpdate({ email: email.toLowerCase() }, { passwordHash: await bcrypt.hash(password, 10), role }, { upsert: true });
  console.log("তৈরি/হালনাগাদ হয়েছে:", email, role);
  process.exit(0);
})();
