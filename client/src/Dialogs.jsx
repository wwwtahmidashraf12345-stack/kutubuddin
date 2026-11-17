import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { MN, YEARS, bn, iso, smsText } from "./util";

export function Modal({ children, onClose }) {
  const r = useRef();
  useEffect(() => { r.current.showModal(); }, []);
  return <dialog ref={r} onClose={onClose}>{children}</dialog>;
}

export function EntryDialog({ members, init, onClose, onDone }) {
  const [mid, setMid] = useState(init.mid), [y, setY] = useState(init.pm.slice(0, 4)), [selectedMonths, setSelectedMonths] = useState([init.pm.slice(5)]);
  const [f, setF] = useState({ d: iso(new Date()), a: "", b: "", o: "" }), [payments, setPayments] = useState([]), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(false);
  const m = members.find((x) => x._id === mid);
  const selectedPms = selectedMonths.map((mo) => y + "-" + mo);
  const ex = selectedPms.length === 1 ? payments.find((p) => p.paidMonth === selectedPms[0]) || null : null;
  useEffect(() => {
    let ok = true;
    setLoading(true);
    setLoadError(false);
    setPayments([]);
    api.get(`/members/${mid}/payments`).then((list) => {
      if (!ok) return;
      setPayments(list);
      const r = selectedPms.length === 1 ? list.find((p) => p.paidMonth === selectedPms[0]) : null;
      setF({ d: r ? r.paidDate : iso(new Date()), a: r ? r.amount : m.monthly || "", b: r ? r.receiptNo : "", o: r ? r.note : "" });
      setLoading(false);
    }).catch((e) => { if (ok) { alert(e.message); setLoadError(true); setLoading(false); } });
    return () => { ok = false; };
  }, [mid]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleMonth = (mo) => (e) => {
    const next = e.target.checked ? [...selectedMonths, mo] : selectedMonths.filter((x) => x !== mo);
    setSelectedMonths(next);
    if (next.length === 1) {
      const r = payments.find((p) => p.paidMonth === y + "-" + next[0]);
      if (r) setF({ d: r.paidDate, a: r.amount, b: r.receiptNo, o: r.note });
    }
  };
  const save = async () => {
    if (loading || loadError) return;
    if (!selectedPms.length) return alert("অন্তত একটি মাস নির্বাচন করুন");
    if (!(Number(f.a) > 0) || !f.d) return alert("সঠিক পরিমাণ ও তারিখ দিন");
    const existing = selectedPms.filter((pm) => payments.some((p) => p.paidMonth === pm));
    const pms = selectedPms.length === 1 && existing.length === 1
      ? selectedPms
      : selectedPms.filter((pm) => !existing.includes(pm));
    if (!pms.length) return alert("নির্বাচিত মাসগুলোতে আগে থেকেই এন্ট্রি আছে");
    setBusy(true);
    const results = [];
    try {
      for (const paidMonth of pms) {
        results.push(await api.put("/payments", { member: mid, paidMonth, paidDate: f.d, amount: Number(f.a), receiptNo: f.b, note: f.o }));
      }
      onDone({ batch: results }, m);
      if (existing.length) alert(existing.length + "টি আগে-জমা মাস বাদ দেওয়া হয়েছে");
    } catch (e) {
      if (results.length) onDone({ batch: results }, m);
      alert(results.length ? `${results.length}টি মাসে এন্ট্রি হয়েছে; পরের এন্ট্রি ব্যর্থ: ${e.message}` : e.message);
      setBusy(false);
    }
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
      <label>বছর</label><select value={y} onChange={(e) => {
        const nextYear = e.target.value;
        setY(nextYear);
        if (selectedMonths.length === 1) {
          const r = payments.find((p) => p.paidMonth === nextYear + "-" + selectedMonths[0]);
          setF(r ? { d: r.paidDate, a: r.amount, b: r.receiptNo, o: r.note } : { d: iso(new Date()), a: m.monthly || "", b: "", o: "" });
        }
      }}>{YEARS.map((v) => <option key={v}>{v}</option>)}</select>
      <label>মাস নির্বাচন করুন</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px 8px" }}>
        {MN.map((name, i) => {
          const mo = String(i + 1).padStart(2, "0"), paid = payments.some((p) => p.paidMonth === y + "-" + mo);
          return <label key={mo} style={{ display: "flex", alignItems: "center", gap: 5, margin: "4px 0", color: "var(--ink)" }}>
            <input type="checkbox" checked={selectedMonths.includes(mo)} onChange={toggleMonth(mo)} style={{ width: "auto" }} />
            {name}{paid && <span style={{ color: "var(--soft)", fontSize: 11 }}>✓</span>}
          </label>;
        })}
      </div>
      <div style={{ color: "var(--soft)", fontSize: 12, marginTop: 4 }}>আগে জমা থাকা মাসগুলো একাধিক মাসের এন্ট্রিতে বাদ থাকবে। একটি মাত্র আগে-জমা মাস নির্বাচন করলে তার তথ্য সম্পাদনা হবে।</div>
      <label>তারিখ</label><input type="date" value={f.d} onChange={set("d")} />
      <label>টাকার পরিমাণ</label><input type="number" inputMode="numeric" value={f.a} onChange={set("a")} placeholder="০" />
      <label>বই / রশিদ নং</label><input value={f.b} onChange={set("b")} placeholder="হাতে লিখুন" />
      <label>বিবরণ (ঐচ্ছিক)</label><input value={f.o} onChange={set("o")} />
      <div className="acts">
        {ex && m.phone && <button className="btn ghost" onClick={resend}>✉️ এসএমএস</button>}
        {ex && <button className="btn x" onClick={del}>মুছুন</button>}
        <button className="btn ghost" onClick={onClose}>বাতিল</button>
        <button className="btn b" disabled={busy || loading || loadError} onClick={save}>সংরক্ষণ</button>
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
