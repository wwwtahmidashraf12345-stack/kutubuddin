import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { MN, YEARS, bn, iso, smsText } from "./util";

export function Modal({ children, onClose }) {
  const r = useRef();
  useEffect(() => { r.current.showModal(); }, []);
  return <dialog ref={r} onClose={onClose}>{children}</dialog>;
}

export function EntryDialog({ members, init, onClose, onDone }) {
  const [mid, setMid] = useState(init.mid), [y, setY] = useState(init.pm.slice(0, 4)), [mo, setMo] = useState(init.pm.slice(5));
  const [f, setF] = useState({ d: iso(new Date()), a: "", b: "", o: "" }), [ex, setEx] = useState(null), [busy, setBusy] = useState(false);
  const m = members.find((x) => x._id === mid), pm = y + "-" + mo;
  useEffect(() => {
    let ok = true;
    api.get(`/members/${mid}/payments`).then((list) => {
      if (!ok) return;
      const r = list.find((p) => p.paidMonth === pm);
      setEx(r || null);
      setF({ d: r ? r.paidDate : iso(new Date()), a: r ? r.amount : m.monthly || "", b: r ? r.receiptNo : "", o: r ? r.note : "" });
    }).catch((e) => alert(e.message));
    return () => { ok = false; };
  }, [mid, pm]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!(Number(f.a) > 0) || !f.d) return alert("সঠিক পরিমাণ ও তারিখ দিন");
    setBusy(true);
    try { onDone(await api.put("/payments", { member: mid, paidMonth: pm, paidDate: f.d, amount: Number(f.a), receiptNo: f.b, note: f.o }), m); }
    catch (e) { alert(e.message); setBusy(false); }
  };
  const del = async () => { if (!confirm("এই এন্ট্রি মুছে ফেলতে চান?")) return; try { await api.del("/payments/" + ex._id); onDone(null); } catch (e) { alert(e.message); } };
  const resend = async () => {
    if (!confirm("এই সদস্যকে আবার এসএমএস পাঠাবেন? (গেটওয়ে থেকে টাকা কাটবে)")) return;
    try { onDone({ payment: ex, created: true, sms: await api.post(`/payments/${ex._id}/sms`) }, m); } catch (e) { alert(e.message); }
  };
  return (
    <Modal onClose={onClose}>
      <h2>দান এন্ট্রি</h2>
      <label>সদস্য</label>
      <select value={mid} onChange={(e) => setMid(e.target.value)}>{members.map((x) => <option key={x._id} value={x._id}>{bn(x.no)} – {x.name}</option>)}</select>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><label>বছর</label><select value={y} onChange={(e) => setY(e.target.value)}>{YEARS.map((v) => <option key={v}>{v}</option>)}</select></div>
        <div style={{ flex: 1 }}><label>মাস</label><select value={mo} onChange={(e) => setMo(e.target.value)}>{MN.map((v, i) => <option key={v} value={String(i + 1).padStart(2, "0")}>{v}</option>)}</select></div>
      </div>
      <label>তারিখ</label><input type="date" value={f.d} onChange={set("d")} />
      <label>টাকার পরিমাণ</label><input type="number" inputMode="numeric" value={f.a} onChange={set("a")} placeholder="০" />
      <label>বই / রশিদ নং</label><input value={f.b} onChange={set("b")} placeholder="হাতে লিখুন" />
      <label>বিবরণ (ঐচ্ছিক)</label><input value={f.o} onChange={set("o")} />
      <div className="acts">
        {ex && m.phone && <button className="btn ghost" onClick={resend}>✉️ এসএমএস</button>}
        {ex && <button className="btn x" onClick={del}>মুছুন</button>}
        <button className="btn ghost" onClick={onClose}>বাতিল</button>
        <button className="btn b" disabled={busy} onClick={save}>সংরক্ষণ</button>
      </div>
    </Modal>
  );
}

// গেটওয়ে ব্যর্থ হলে বা চালু না থাকলে: নিজে পাঠানোর বিকল্প
export function SmsFallback({ member, payment, err, onClose }) {
  const [t, setT] = useState(smsText(member.name, payment.paidMonth, payment.amount, payment.paidDate, payment.receiptNo));
  const num = (member.phone || "").replace(/[^\d+]/g, "");
  const copy = () => navigator.clipboard?.writeText(t).then(() => alert("বার্তা কপি হয়েছে"), () => alert(t));
  const send = () => { onClose(); location.href = "sms:" + num + "?&body=" + encodeURIComponent(t); };
  return (
    <Modal onClose={onClose}>
      <h2>গেটওয়ে থেকে পাঠানো যায়নি</h2>
      <div className="note">{err}</div>
      <label>{member.name} — {bn(member.phone)} নম্বরে নিজে পাঠান</label>
      <textarea rows={7} value={t} onChange={(e) => setT(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "var(--card)", color: "var(--ink)", font: "16px 'Hind Siliguri',sans-serif" }} />
      <div className="acts">
        <button className="btn ghost" onClick={onClose}>পরে</button>
        <button className="btn" onClick={copy}>বার্তা কপি</button>
        <button className="btn b" onClick={send}>✉️ মেসেজ অ্যাপে খুলুন</button>
      </div>
    </Modal>
  );
}
