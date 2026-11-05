const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const User = model("User", new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "viewer"], default: "viewer" },
}, { timestamps: true }));

const Member = model("Member", new Schema({
  no: { type: Number, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: "", trim: true },
  address: { type: String, default: "", trim: true },
  monthly: { type: Number, default: 0 },
}, { timestamps: true }));

const paySchema = new Schema({
  member: { type: Schema.Types.ObjectId, ref: "Member", default: null },
  memberName: { type: String, required: true },
  paidMonth: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  paidDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  amount: { type: Number, required: true, min: 1 },
  receiptNo: { type: String, default: "" },
  note: { type: String, default: "" },
  createdBy: { type: String, default: "" },
}, { timestamps: true });
paySchema.index({ member: 1, paidMonth: 1 }, { unique: true, partialFilterExpression: { member: { $type: "objectId" } } });
paySchema.index({ paidDate: 1 });
const Payment = model("Payment", paySchema);

const SmsLog = model("SmsLog", new Schema({
  payment: Schema.Types.ObjectId, phone: String, message: String, ok: Boolean, response: String,
}, { timestamps: true }));

module.exports = { User, Member, Payment, SmsLog };
