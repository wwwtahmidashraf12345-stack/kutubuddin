export const BD = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
export const MN = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
export const WD = ["রবি","সোম","মঙ্গল","বুধ","বৃহ","শুক্র","শনি"];
export const YEARS = Array.from({ length: 15 }, (_, i) => 2026 + i);
export const bn = (n) => String(n).replace(/[0-9]/g, (d) => BD[d]);
export const taka = (n) => "৳" + bn((Number(n) || 0).toLocaleString("en-IN"));
export const p2 = (n) => String(n).padStart(2, "0");
export const iso = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
export const bnDate = (s) => { const [y, m, d] = s.split("-"); return bn(+d) + " " + MN[m - 1] + ", " + bn(y); };
export const nd = (x) => String(x == null ? "" : x).replace(/[০-৯]/g, (c) => BD.indexOf(c)).trim();
export const H = (r, names) => { for (const k of Object.keys(r)) { const kk = nd(k).replace(/\s+/g, "").toLowerCase(); if (names.some((n) => kk.startsWith(n))) return r[k]; } return ""; };
export function span(tab) {
  const n = new Date();
  if (tab === "today") { const t = iso(n); return [t, t, "আজকের কালেকশন"]; }
  if (tab === "week") { const s = new Date(n); s.setDate(n.getDate() - ((n.getDay() + 1) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return [iso(s), iso(e), "এই সপ্তাহের কালেকশন (শনি–শুক্র)"]; }
  return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)), MN[n.getMonth()] + " মাসের কালেকশন"];
}
export const smsText = (name, pm, amount, date, receipt) => {
  const [y, m] = pm.split("-");
  return `আসসালামু আলাইকুম, ${name}।\nমারকাযুল হক মুন্সিগঞ্জ (চাম্পাতলা মাদরাসা)-এ আপনার ${MN[m - 1]} ${bn(y)} মাসের দান ${bn(amount)} টাকা গ্রহণ করা হয়েছে (${bnDate(date)})।${receipt ? " রশিদ নং " + bn(receipt) + "।" : ""}\nজাযাকাল্লাহু খাইরান।`;
};
