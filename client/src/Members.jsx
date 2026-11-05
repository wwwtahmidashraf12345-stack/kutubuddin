import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import { Modal } from "./Dialogs";
import { MN, YEARS, bn, bnDate, taka, nd, H } from "./util";

const nrm = (x) => nd(x).toLowerCase();

function MemberDialog({ m, members, onClose, onSaved }) {
  const [f, setF] = useState({ no: m ? m.no : Math.max(0, ...members.map((x) => x.no)) + 1, name: m?.name || "", phone: m?.phone || "", address: m?.address || "", monthly: m?.monthly || "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.name.trim()) return alert("নাম লিখুন");
    if (!(Number(f.no) > 0)) return alert("সঠিক সদস্য নং দিন");
    try { onSaved(m ? await api.put("/members/" + m._id, f) : await api.post("/members", f)); } catch (e) { alert(e.message); }
  };
  return (
    <Modal onClose={onClose}>
      <h2>{m ? "সদস্যের তথ্য" : "নতুন সদস্য"}</h2>
      <label>সদস্য নং</label><input type="number" inputMode="numeric" value={f.no} onChange={set("no")} />
      <label>নাম *</label><input value={f.name} onChange={set("name")} />
      <label>ঠিকানা</label><input value={f.address} onChange={set("address")} />
      <label>মোবাইল নম্বর</label><input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} />
      <label>মাসিক দানের পরিমাণ (টাকা)</label><input type="number" inputMode="numeric" value={f.monthly} onChange={set("monthly")} />
      <div className="acts"><button className="btn ghost" onClick={onClose}>বাতিল</button><button className="btn b" onClick={save}>সংরক্ষণ</button></div>
    </Modal>
  );
}

function Profile({ m, admin, refresh, back, openEntry, onEdit, onDelete }) {
  const [py, setPy] = useState(new Date().getFullYear()), [pays, setPays] = useState(null);
  useEffect(() => { api.get(`/members/${m._id}/payments`).then(setPays).catch((e) => alert(e.message)); }, [m._id, refresh]);
  const mm = {}; (pays || []).forEach((p) => (mm[p.paidMonth] = p));
  const all = (pays || []).reduce((s, p) => s + p.amount, 0), ytot = (pays || []).filter((p) => p.paidMonth.startsWith(py)).reduce((s, p) => s + p.amount, 0);
  return (
    <>
      <button className="back" onClick={back}>‹ সদস্য তালিকা</button>
      <div className="prof">
        <div className="nm">{m.name}</div><div>সদস্য নং: <b>{bn(m.no)}</b></div>
        {m.phone && <div>📞 {bn(m.phone)} <a href={"tel:" + nrm(m.phone).replace(/[^\d+]/g, "")} style={{ marginLeft: 8, background: "var(--brass)", color: "var(--g)", borderRadius: 18, padding: "5px 14px", font: "700 13px 'Hind Siliguri',sans-serif", textDecoration: "none", display: "inline-block" }}>কল করুন</a></div>}
        {m.address && <div>📍 {m.address}</div>}
        <div>মাসিক দান: <b>{taka(m.monthly)}</b></div><div>মোট জমা: <b>{taka(all)}</b></div>
        {admin && <div style={{ marginTop: 10 }}><button className="btn b" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onEdit}>তথ্য সম্পাদনা</button> <button className="btn x" onClick={onDelete}>মুছুন</button></div>}
      </div>
      <div className="tabs">{YEARS.map((y) => <button key={y} className={y === py ? "on" : ""} onClick={() => setPy(y)}>{bn(y)}</button>)}</div>
      <div className="note" style={{ background: "none", color: "var(--soft)", padding: "0 0 8px" }}>{bn(py)} সালে জমা: {taka(ytot)}</div>
      {MN.map((name, i) => { const pm = py + "-" + String(i + 1).padStart(2, "0"), r = mm[pm]; return (
        <div key={pm} className={"mrow " + (r ? "f" : "")} style={admin ? { cursor: "pointer" } : {}} onClick={() => admin && openEntry(m._id, pm)}>
          <div className="mn">{name}</div>
          {r ? <><div className="mi">{bnDate(r.paidDate)}{r.receiptNo && <><br />রশিদ নং {bn(r.receiptNo)}</>}</div><div className="a" style={{ font: "700 15px 'Tiro Bangla',serif" }}>{taka(r.amount)}</div></>
             : <><div className="em">এখনো জমা হয়নি{admin ? " — এন্ট্রি করুন" : ""}</div>{admin && <span style={{ color: "var(--brass)", fontSize: 18 }}>＋</span>}</>}
        </div>); })}
    </>
  );
}

export function MembersTab({ members, admin, pid, setPid, reload, refresh, openEntry }) {
  const [q, setQ] = useState(""), [dlg, setDlg] = useState(null);
  const k = nrm(q.trim()), cur = members.find((m) => m._id === pid);
  const list = members.filter((m) => !k || nrm(m.name).includes(k) || (/^\d+$/.test(k) && String(m.no).startsWith(k)) || nrm(m.phone).includes(k));
  const saved = async (m) => { setDlg(null); await reload(); setPid(m._id); };
  const del = async () => { if (!confirm("এই সদস্যকে মুছতে চান? আগের কালেকশনের হিসাব থাকবে।")) return; try { await api.del("/members/" + pid); setPid(null); reload(); } catch (e) { alert(e.message); } };
  const importXlsx = async (e) => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const sh = wb.SheetNames.find((x) => x.trim() === "সদস্য") || wb.SheetNames.find((x) => x.trim() !== "নির্দেশনা");
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: "" }).map((r) => ({ no: H(r, ["সদস্যনং"]), name: H(r, ["নাম"]), phone: H(r, ["মোবাইল"]), address: H(r, ["ঠিকানা"]), monthly: H(r, ["মাসিক"]) }));
      const d = await api.post("/members/import?dry=1", { rows });
      if (!d.add) return alert("নতুন সদস্য পাওয়া যায়নি।" + (d.skipped.length ? "\n\n" + d.skipped.slice(0, 8).join("\n") : ""));
      if (!confirm(`${d.add} জন নতুন সদস্য যোগ হবে (সদস্য নং ${d.firstNo} থেকে)।` + (d.skipped.length ? `\n\nবাদ ${d.skipped.length} টি:\n` + d.skipped.slice(0, 8).join("\n") : "") + "\n\nযোগ করবেন?")) return;
      await api.post("/members/import", { rows }); await reload(); alert(d.add + " জন সদস্য যোগ হয়েছে ✔");
    } catch (err) { alert("আমদানি ব্যর্থ: " + err.message); }
  };
  if (cur) return (<>
    <Profile m={cur} admin={admin} refresh={refresh} back={() => setPid(null)} openEntry={openEntry} onEdit={() => setDlg(cur)} onDelete={del} />
    {dlg && <MemberDialog m={dlg} members={members} onClose={() => setDlg(null)} onSaved={saved} />}
  </>);
  return (
    <>
      {admin && <><button className="btn b" style={{ width: "100%", marginBottom: 10 }} onClick={() => setDlg("new")}>＋ নতুন সদস্য যোগ করুন</button>
        <label className="btn" style={{ display: "block", textAlign: "center", marginBottom: 10 }}>📥 এক্সেল থেকে নতুন সদস্য যোগ<input type="file" hidden accept=".xlsx,.xls,.csv" onChange={importXlsx} /></label></>}
      <input placeholder="🔍 নাম বা সদস্য নং দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {list.length ? <><div className="date" style={{ marginTop: 0 }}>{bn(list.length)} জন সদস্য</div>
        {list.map((m) => <div key={m._id} className="row" style={{ cursor: "pointer" }} onClick={() => setPid(m._id)}><span className="no">নং {bn(m.no)}</span>
          <div className="m"><div className="n">{m.name}</div><div className="s">{[m.phone && bn(m.phone), m.monthly ? "মাসিক " + taka(m.monthly) : "", m.address].filter(Boolean).join(" • ")}</div></div><span style={{ color: "var(--brass)" }}>›</span></div>)}</>
        : <div className="empty">{members.length ? "কোনো সদস্য পাওয়া যায়নি" : "এখনো কোনো সদস্য যোগ করা হয়নি"}</div>}
      {dlg && <MemberDialog m={dlg === "new" ? null : dlg} members={members} onClose={() => setDlg(null)} onSaved={saved} />}
    </>
  );
}
