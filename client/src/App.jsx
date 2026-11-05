import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, setToken } from "./api";
import { iso, span } from "./util";
import Summary from "./Summary";
import { MembersTab } from "./Members";
import { EntryDialog, SmsFallback } from "./Dialogs";

const TABS = [["today", "আজ"], ["week", "এই সপ্তাহ"], ["month", "এই মাস"], ["hist", "হিস্ট্রি"], ["mem", "সদস্য"]];

function Login({ onLogin }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const go = async () => { try { const d = await api.post("/auth/login", { email, password }); setToken(d.token); onLogin(d.user); } catch (e) { alert(e.message); } };
  return (
    <div style={{ maxWidth: 360, margin: "20px auto" }}>
      <h3>লগইন করুন</h3>
      <label>ইমেইল</label><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>পাসওয়ার্ড</label><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      <button className="btn b" style={{ width: "100%", marginTop: 14 }} onClick={go}>প্রবেশ করুন</button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), [tab, setTab] = useState("today"), [members, setMembers] = useState([]);
  const [pid, setPid] = useState(null), [entry, setEntry] = useState(null), [fallback, setFallback] = useState(null), [toast, setToast] = useState(""), [refresh, setRefresh] = useState(0);
  const [range, setRange] = useState([iso(new Date()), iso(new Date())]), [draft, setDraft] = useState([iso(new Date()), iso(new Date())]);
  const ttl = useRef(), admin = user?.role === "admin";

  useLayoutEffect(() => {
    const fit = () => { const t = ttl.current; if (!t) return; let z = 34; t.style.fontSize = z + "px"; while (t.scrollWidth > t.clientWidth && z > 9) { z--; t.style.fontSize = z + "px"; } };
    fit(); addEventListener("resize", fit); document.fonts?.ready.then(fit);
    return () => removeEventListener("resize", fit);
  }, []);
  const logout = useCallback(() => { setToken(""); setUser(null); setMembers([]); setPid(null); }, []);
  const reload = useCallback(() => api.get("/members").then(setMembers).catch((e) => (e.status === 401 ? logout() : alert(e.message))), [logout]);
  useEffect(() => { api.get("/me").then((d) => setUser(d.user)).catch(() => {}).finally(() => setReady(true)); }, []);
  useEffect(() => { if (user) reload(); }, [user, reload]);
  const say = (t) => { setToast(t); setTimeout(() => setToast(""), 3500); };

  const openEntry = (mid, pm) => setEntry({ mid, pm });
  const onDone = (res, m) => {
    setEntry(null); setRefresh((x) => x + 1);
    if (res?.created && res.sms?.attempted) res.sms.ok ? say("✉️ এসএমএস পাঠানো হয়েছে") : setFallback({ member: m, payment: res.payment, err: res.sms.error });
  };
  const fab = () => {
    if (!members.length) { setTab("mem"); return alert("আগে সদস্যদের নাম যোগ করুন"); }
    const n = new Date(); openEntry(pid || members[0]._id, n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0"));
  };

  const [from, to, title] = tab === "hist" ? [range[0], range[1], "নির্বাচিত সময়ের কালেকশন"] : span(tab);
  return (
    <>
      <header>
        <h1 id="ttl" ref={ttl}>মারকাযুল হক মুন্সিগঞ্জ (চাম্পাতলা মাদরাসা)</h1><p>কালেকশনের হিসাব</p>
        {user && <button className="lockb" onClick={() => confirm("লগআউট করবেন?") && logout()}>{admin ? "✏️ অ্যাডমিন" : "👁 দর্শক"} — {user.email} • লগআউট</button>}
      </header>
      {user && <nav>{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPid(null); }}>{l}</button>)}</nav>}
      <main>
        {!ready ? <div className="empty">খাতা খোলা হচ্ছে...</div> : !user ? <Login onLogin={setUser} /> :
          tab === "mem" ? <MembersTab members={members} admin={admin} pid={pid} setPid={setPid} reload={reload} refresh={refresh} openEntry={openEntry} /> : <>
            {tab === "hist" && <div className="rng">
              <div><label>শুরুর তারিখ</label><input type="date" value={draft[0]} onChange={(e) => setDraft([e.target.value, draft[1]])} /></div>
              <div><label>শেষ তারিখ</label><input type="date" value={draft[1]} onChange={(e) => setDraft([draft[0], e.target.value])} /></div>
              <button className="btn" onClick={() => setRange(draft)}>দেখুন</button></div>}
            <Summary tab={tab} from={from} to={to} title={title} admin={admin} refresh={refresh} members={members} onEdit={openEntry} />
          </>}
      </main>
      {admin && !(tab === "mem" && !pid) && <button className="btn b fab" onClick={fab}>＋ নতুন কালেকশন</button>}
      {entry && <EntryDialog members={members} init={entry} onClose={() => setEntry(null)} onDone={onDone} />}
      {fallback && <SmsFallback {...fallback} onClose={() => setFallback(null)} />}
      {toast && <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 90, background: "#16332B", color: "#F1E9D2", border: "1px solid #C9A24B", borderRadius: 20, padding: "10px 18px", zIndex: 99, font: "600 14px 'Hind Siliguri',sans-serif" }}>{toast}</div>}
    </>
  );
}
