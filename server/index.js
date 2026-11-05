require("dotenv").config();
const express = require("express"), mongoose = require("mongoose"), bcrypt = require("bcryptjs"), jwt = require("jsonwebtoken");
const helmet = require("helmet"), rateLimit = require("express-rate-limit"), path = require("path"), fs = require("fs");
const { User, Member, Payment } = require("./models");
const { sendPaymentSms } = require("./sms");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
const wrap = (f) => (req, res, next) => f(req, res, next).catch(next);
const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "লগইন করুন" }); }
};
const admin = (req, res, next) => (req.user.role === "admin" ? next() : res.status(403).json({ error: "শুধু অ্যাডমিন করতে পারবেন" }));
const BD = "০১২৩৪৫৬৭৮৯", en = (s) => String(s == null ? "" : s).replace(/[০-৯]/g, (c) => String(BD.indexOf(c))).trim();
const cleanPhone = (s) => { let p = en(s).replace(/[^\d+]/g, ""); return /^1\d{9}$/.test(p) ? "0" + p : p; };

// ---------- লগইন ----------
app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), wrap(async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || "").toLowerCase().trim() });
  if (!u || !(await bcrypt.compare(String(req.body.password || ""), u.passwordHash))) return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
  const token = jwt.sign({ id: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { email: u.email, role: u.role } });
}));
app.get("/api/me", auth, (req, res) => res.json({ user: { email: req.user.email, role: req.user.role } }));

// ---------- সদস্য ----------
app.get("/api/members", auth, wrap(async (_q, res) => res.json(await Member.find().sort("no").lean())));
const memberBody = (b) => ({ no: Number(en(b.no)), name: String(b.name || "").trim(), phone: cleanPhone(b.phone), address: String(b.address || "").trim(), monthly: Number(en(b.monthly).replace(/,/g, "")) || 0 });
const dupMsg = (e, res) => (e.code === 11000 ? res.status(409).json({ error: "এই সদস্য নং আগে থেকেই আছে" }) : null);
app.post("/api/members", auth, admin, wrap(async (req, res) => {
  const b = memberBody(req.body);
  if (!b.name || !(b.no > 0)) return res.status(400).json({ error: "নাম ও সদস্য নং দিন" });
  try { res.json(await Member.create(b)); } catch (e) { if (!dupMsg(e, res)) throw e; }
}));
app.put("/api/members/:id", auth, admin, wrap(async (req, res) => {
  const b = memberBody(req.body);
  if (!b.name || !(b.no > 0)) return res.status(400).json({ error: "নাম ও সদস্য নং দিন" });
  try {
    const m = await Member.findByIdAndUpdate(req.params.id, b, { new: true });
    if (!m) return res.status(404).json({ error: "সদস্য পাওয়া যায়নি" });
    res.json(m);
  } catch (e) { if (!dupMsg(e, res)) throw e; }
}));
app.delete("/api/members/:id", auth, admin, wrap(async (req, res) => {
  await Member.findByIdAndDelete(req.params.id);
  await Payment.updateMany({ member: req.params.id }, { member: null }); // হিসাব থেকে যাবে, নাম থাকবে
  res.json({ ok: true });
}));
// এক্সেল থেকে নতুন সদস্য: ?dry=1 দিলে শুধু সারাংশ
app.post("/api/members/import", auth, admin, wrap(async (req, res) => {
  const existing = await Member.find().lean(), used = new Set(existing.map((m) => m.no)), skipped = [], list = [];
  (req.body.rows || []).forEach((r, i) => {
    const b = memberBody(r), ln = "সারি " + (i + 2) + ": ";
    if (!b.name) return;
    if (existing.some((m) => m.name === b.name && m.phone === b.phone)) return skipped.push(ln + b.name + " আগে থেকেই আছে — বাদ");
    if (b.no > 0 && used.has(b.no)) return skipped.push(ln + "সদস্য নং " + b.no + " আগে থেকেই আছে — বাদ");
    if (b.no > 0) used.add(b.no);
    list.push(b);
  });
  let mx = Math.max(0, ...used);
  list.forEach((b) => { if (!(b.no > 0)) { while (used.has(++mx)); b.no = mx; used.add(mx); } });
  if (!req.query.dry && list.length) await Member.insertMany(list);
  res.json({ add: list.length, firstNo: list[0] && list[0].no, skipped });
}));

// ---------- জমা ----------
app.get("/api/payments", auth, wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) return res.status(400).json({ error: "তারিখ সঠিক নয়" });
  res.json(await Payment.find({ paidDate: { $gte: from, $lte: to } }).sort({ paidDate: -1, createdAt: -1 }).limit(5000).lean());
}));
app.get("/api/members/:id/payments", auth, wrap(async (req, res) => res.json(await Payment.find({ member: req.params.id }).lean())));
app.put("/api/payments", auth, admin, wrap(async (req, res) => {
  const b = req.body, amount = Number(en(b.amount));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.paidMonth || "") || !/^\d{4}-\d{2}-\d{2}$/.test(b.paidDate || "") || !(amount > 0)) return res.status(400).json({ error: "মাস, তারিখ বা টাকা সঠিক নয়" });
  const m = await Member.findById(b.member);
  if (!m) return res.status(404).json({ error: "সদস্য পাওয়া যায়নি" });
  const data = { memberName: m.name, paidDate: b.paidDate, amount, receiptNo: String(b.receiptNo || "").trim(), note: String(b.note || "").trim(), createdBy: req.user.email };
  let p = await Payment.findOne({ member: m._id, paidMonth: b.paidMonth });
  const created = !p;
  if (p) { Object.assign(p, data); await p.save(); } else p = await Payment.create({ member: m._id, paidMonth: b.paidMonth, ...data });
  res.json({ payment: p, created, sms: created ? await sendPaymentSms(m, p) : { attempted: false } });
}));
app.post("/api/payments/:id/sms", auth, admin, wrap(async (req, res) => {
  const p = await Payment.findById(req.params.id), m = p && (await Member.findById(p.member));
  if (!p || !m) return res.status(404).json({ error: "পাওয়া যায়নি" });
  res.json(await sendPaymentSms(m, p));
}));
app.delete("/api/payments/:id", auth, admin, wrap(async (req, res) => { await Payment.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---------- ফ্রন্টএন্ড (বিল্ড করা থাকলে) ----------
const dist = path.join(__dirname, "../client/dist");
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api).*/, (_q, res) => res.sendFile(path.join(dist, "index.html"))); }

app.use((err, _q, res, _n) => { console.error(err); res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে" }); });
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) { console.error("server/.env এ MONGODB_URI ও JWT_SECRET দিন"); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI).then(() => app.listen(process.env.PORT || 5000, () => console.log("চালু:", process.env.PORT || 5000)));
