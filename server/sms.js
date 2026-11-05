const { SmsLog } = require("./models");
const BD = "০১২৩৪৫৬৭৮৯";
const MN = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const bn = (s) => String(s).replace(/\d/g, (d) => BD[+d]);
const en = (s) => String(s || "").replace(/[০-৯]/g, (c) => String(BD.indexOf(c)));

function buildMessage(name, p) {
  const [y, m] = p.paidMonth.split("-");
  const [dy, dm, dd] = p.paidDate.split("-");
  return `আসসালামু আলাইকুম, ${name}।\nমারকাযুল হক মুন্সিগঞ্জ (চাম্পাতলা মাদরাসা)-এ আপনার ${MN[+m - 1]} ${bn(y)} মাসের দান ${bn(p.amount)} টাকা গ্রহণ করা হয়েছে (${bn(+dd)} ${MN[+dm - 1]}, ${bn(dy)})।${p.receiptNo ? ` রশিদ নং ${bn(p.receiptNo)}।` : ""}\nজাযাকাল্লাহু খাইরান।`;
}

// ফেরত দেয়: { attempted, ok, error }
async function sendPaymentSms(member, p) {
  if (!member || !member.phone || process.env.SMS_ENABLED === "false") return { attempted: false };
  const gw = process.env.SMS_GATEWAY_URL;
  if (!gw) return { attempted: true, ok: false, error: "এসএমএস গেটওয়ে এখনো যোগ করা হয়নি" };
  let d = en(member.phone).replace(/\D/g, "");
  if (d.startsWith("0")) d = "88" + d;
  if (!/^8801\d{9}$/.test(d)) return { attempted: true, ok: false, error: "মোবাইল নম্বর সঠিক নয়" };
  const to = process.env.SMS_NUMBER_FORMAT === "local" ? "0" + d.slice(2) : d;
  const message = buildMessage(member.name, p);
  const fill = (t, enc) => t.split("{to}").join(enc(to)).split("{message}").join(enc(message));
  try {
    let res;
    if ((process.env.SMS_METHOD || "GET").toUpperCase() === "GET") res = await fetch(fill(gw, encodeURIComponent));
    else {
      const ct = process.env.SMS_CONTENT_TYPE || "application/json";
      const enc = ct.includes("json") ? (s) => JSON.stringify(s).slice(1, -1) : encodeURIComponent;
      res = await fetch(fill(gw, (s) => s), { method: "POST", headers: { "Content-Type": ct }, body: fill(process.env.SMS_BODY || "", enc) });
    }
    const text = await res.text();
    const must = process.env.SMS_SUCCESS_MATCH;
    const ok = res.ok && (!must || text.includes(must));
    await SmsLog.create({ payment: p._id, phone: to, message, ok, response: text.slice(0, 500) });
    return { attempted: true, ok, error: ok ? undefined : "গেটওয়ে: " + text.slice(0, 120) };
  } catch (e) {
    return { attempted: true, ok: false, error: "গেটওয়ে সংযোগ ব্যর্থ: " + e.message };
  }
}
module.exports = { sendPaymentSms };
