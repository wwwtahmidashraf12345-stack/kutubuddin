require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { User, Member, Payment } = require("./models");
const { sendPaymentSms } = require("./sms");

const app = express();

// ---------- Security ----------

app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: "2mb" }));

// ---------- MongoDB Connection Cache ----------

let dbPromise = null;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI পাওয়া যায়নি");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!dbPromise) {
    dbPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  await dbPromise;
}

// API চালানোর আগে Database Connection নিশ্চিত করা

app.use("/api", async (req, res, next) => {
  try {
    await connectDB();

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "JWT_SECRET কনফিগার করা হয়নি"
      });
    }

    next();
  } catch (error) {
    console.error("Database Error:", error.message);

    res.status(503).json({
      error: "ডাটাবেজ সংযোগে সমস্যা হয়েছে"
    });
  }
});

// ---------- Helper ----------

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const auth = (req, res, next) => {
  try {
    const token = (req.headers.authorization || "")
      .replace("Bearer ", "");

    req.user = jwt.verify(token, process.env.JWT_SECRET);

    next();
  } catch {
    res.status(401).json({
      error: "লগইন করুন"
    });
  }
};

const admin = (req, res, next) =>
  req.user.role === "admin"
    ? next()
    : res.status(403).json({
        error: "শুধু অ্যাডমিন করতে পারবেন"
      });

const BD = "০১২৩৪৫৬৭৮৯";

const en = (s) =>
  String(s == null ? "" : s)
    .replace(/[০-৯]/g, (c) => String(BD.indexOf(c)))
    .trim();

const cleanPhone = (s) => {
  let p = en(s).replace(/[^\d+]/g, "");

  return /^1\d{9}$/.test(p) ? "0" + p : p;
};

// ---------- Login ----------

app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20
  }),
  wrap(async (req, res) => {
    const u = await User.findOne({
      email: String(req.body.email || "")
        .toLowerCase()
        .trim()
    });

    if (
      !u ||
      !(await bcrypt.compare(
        String(req.body.password || ""),
        u.passwordHash
      ))
    ) {
      return res.status(401).json({
        error: "ইমেইল বা পাসওয়ার্ড ভুল"
      });
    }

    const token = jwt.sign(
      {
        id: u.id,
        email: u.email,
        role: u.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        email: u.email,
        role: u.role
      }
    });
  })
);

app.get("/api/me", auth, (req, res) => {
  res.json({
    user: {
      email: req.user.email,
      role: req.user.role
    }
  });
});

// ---------- Members ----------

app.get(
  "/api/members",
  auth,
  wrap(async (req, res) => {
    res.json(
      await Member.find().sort("no").lean()
    );
  })
);

const memberBody = (b) => ({
  no: Number(en(b.no)),
  name: String(b.name || "").trim(),
  phone: cleanPhone(b.phone),
  address: String(b.address || "").trim(),
  monthly: Number(
    en(b.monthly).replace(/,/g, "")
  ) || 0
});

const dupMsg = (e, res) =>
  e.code === 11000
    ? res.status(409).json({
        error: "এই সদস্য নং আগে থেকেই আছে"
      })
    : null;

// Add Member

app.post(
  "/api/members",
  auth,
  admin,
  wrap(async (req, res) => {
    const b = memberBody(req.body);

    if (!b.name || !(b.no > 0)) {
      return res.status(400).json({
        error: "নাম ও সদস্য নং দিন"
      });
    }

    try {
      res.json(await Member.create(b));
    } catch (e) {
      if (!dupMsg(e, res)) throw e;
    }
  })
);

// Update Member

app.put(
  "/api/members/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const b = memberBody(req.body);

    if (!b.name || !(b.no > 0)) {
      return res.status(400).json({
        error: "নাম ও সদস্য নং দিন"
      });
    }

    try {
      const m = await Member.findByIdAndUpdate(
        req.params.id,
        b,
        { new: true }
      );

      if (!m) {
        return res.status(404).json({
          error: "সদস্য পাওয়া যায়নি"
        });
      }

      res.json(m);
    } catch (e) {
      if (!dupMsg(e, res)) throw e;
    }
  })
);

// Delete Member

app.delete(
  "/api/members/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    await Member.findByIdAndDelete(req.params.id);

    await Payment.updateMany(
      { member: req.params.id },
      { member: null }
    );

    res.json({ ok: true });
  })
);

// Import Members from Excel

app.post(
  "/api/members/import",
  auth,
  admin,
  wrap(async (req, res) => {
    const existing = await Member.find().lean();

    const used = new Set(
      existing.map((m) => m.no)
    );

    const skipped = [];
    const list = [];

    (req.body.rows || []).forEach((r, i) => {
      const b = memberBody(r);
      const ln = "সারি " + (i + 2) + ": ";

      if (!b.name) return;

      if (
        existing.some(
          (m) => m.name === b.name &&
                 m.phone === b.phone
        )
      ) {
        return skipped.push(
          ln + b.name + " আগে থেকেই আছে — বাদ"
        );
      }

      if (b.no > 0 && used.has(b.no)) {
        return skipped.push(
          ln + "সদস্য নং " + b.no +
          " আগে থেকেই আছে — বাদ"
        );
      }

      if (b.no > 0) used.add(b.no);

      list.push(b);
    });

    let mx = Math.max(0, ...used);

    list.forEach((b) => {
      if (!(b.no > 0)) {
        while (used.has(++mx));
        b.no = mx;
        used.add(mx);
      }
    });

    if (!req.query.dry && list.length) {
      await Member.insertMany(list);
    }

    res.json({
      add: list.length,
      firstNo: list[0] && list[0].no,
      skipped
    });
  })
);

// ---------- Payments ----------

// Payment List

app.get(
  "/api/payments",
  auth,
  wrap(async (req, res) => {
    const { from, to } = req.query;

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to || "")
    ) {
      return res.status(400).json({
        error: "তারিখ সঠিক নয়"
      });
    }

    res.json(
      await Payment.find({
        paidDate: {
          $gte: from,
          $lte: to
        }
      })
        .sort({
          paidDate: -1,
          createdAt: -1
        })
        .limit(5000)
        .lean()
    );
  })
);

// Member Payment History

app.get(
  "/api/members/:id/payments",
  auth,
  wrap(async (req, res) => {
    res.json(
      await Payment.find({
        member: req.params.id
      }).lean()
    );
  })
);

// Add / Update Payment

app.put(
  "/api/payments",
  auth,
  admin,
  wrap(async (req, res) => {
    const b = req.body;
    const amount = Number(en(b.amount));

    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.paidMonth || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.paidDate || "") ||
      !(amount > 0)
    ) {
      return res.status(400).json({
        error: "মাস, তারিখ বা টাকা সঠিক নয়"
      });
    }

    const m = await Member.findById(b.member);

    if (!m) {
      return res.status(404).json({
        error: "সদস্য পাওয়া যায়নি"
      });
    }

    const data = {
      memberName: m.name,
      paidDate: b.paidDate,
      amount,
      receiptNo: String(b.receiptNo || "").trim(),
      note: String(b.note || "").trim(),
      createdBy: req.user.email
    };

    let p = await Payment.findOne({
      member: m._id,
      paidMonth: b.paidMonth
    });

    const created = !p;

    if (p) {
      Object.assign(p, data);
      await p.save();
    } else {
      p = await Payment.create({
        member: m._id,
        paidMonth: b.paidMonth,
        ...data
      });
    }

    res.json({
      payment: p,
      created,
      sms: created
        ? await sendPaymentSms(m, p)
        : { attempted: false }
    });
  })
);

// Send SMS Again

app.post(
  "/api/payments/:id/sms",
  auth,
  admin,
  wrap(async (req, res) => {
    const p = await Payment.findById(req.params.id);

    const m = p &&
      await Member.findById(p.member);

    if (!p || !m) {
      return res.status(404).json({
        error: "পাওয়া যায়নি"
      });
    }

    res.json(await sendPaymentSms(m, p));
  })
);

// Delete Payment

app.delete(
  "/api/payments/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    await Payment.findByIdAndDelete(req.params.id);

    res.json({ ok: true });
  })
);

// ---------- Health Check ----------

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Madrasa API is running"
  });
});

// ---------- Error Handler ----------

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "সার্ভারে সমস্যা হয়েছে"
  });
});

// ---------- Export for Vercel ----------

module.exports = app;

// ---------- Local Development ----------

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log("চালু:", PORT);
      });
    })
    .catch((error) => {
      console.error("Database Connection Failed:", error);
      process.exit(1);
    });
}

