import { useEffect, useState } from "react";
import { api } from "./api";
import { WD, bn, bnDate, taka, iso } from "./util";

function Bars({ from, to, tab, list }) {
  const t = {}; list.forEach((e) => (t[e.paidDate] = (t[e.paidDate] || 0) + e.amount));
  const days = [];
  for (let d = new Date(from + "T00:00:00"); iso(d) <= to; d.setDate(d.getDate() + 1)) days.push([iso(d), d.getDay(), d.getDate()]);
  const mx = Math.max(1, ...days.map((x) => t[x[0]] || 0)), td = iso(new Date());
  return (
    <div className="bars">
      {days.map(([k, w, n]) => { const v = t[k] || 0; return (
        <div key={k} className={"bar " + (k === td ? "t" : "")} style={{ minWidth: tab === "month" ? 40 : 15 }}>
          <em>{v ? bn(v) : ""}</em><i style={{ height: Math.max(3, Math.round((v / mx) * 70)) }} />{tab === "week" ? WD[w] : bn(n)}
        </div>); })}
    </div>
  );
}

export default function Summary({ tab, from, to, title, admin, refresh, members, onEdit }) {
  const [list, setList] = useState(null);
  useEffect(() => { setList(null); api.get(`/payments?from=${from}&to=${to}`).then(setList).catch((e) => { alert(e.message); setList([]); }); }, [from, to, refresh]);
  if (!from || !to || from > to) return <div className="empty">সঠিক তারিখ নির্বাচন করুন</div>;
  if (!list) return <div className="empty">লোড হচ্ছে...</div>;
  const sum = list.reduce((s, e) => s + e.amount, 0), cnt = new Set(list.map((e) => e.member || e.memberName)).size;
  const by = {}; list.forEach((e) => { const k = e.member || e.memberName; by[k] = by[k] || { n: e.memberName, v: 0, mid: e.member }; by[k].v += e.amount; });
  const arr = Object.values(by).sort((a, b) => b.v - a.v), top = arr[0] ? arr[0].v : 1;
  const dayTot = {}; list.forEach((e) => (dayTot[e.paidDate] = (dayTot[e.paidDate] || 0) + e.amount));
  let last = "";
  return (
    <>
      <div className="total"><small>{title}</small><small style={{ display: "block" }}>{from === to ? bnDate(from) : bnDate(from) + " – " + bnDate(to)}</small><b>{taka(sum)}</b></div>
      <div className="stats">
        <div><b>{bn(list.length)}</b><span>মোট এন্ট্রি</span></div><div><b>{bn(cnt)}</b><span>জন দিয়েছেন</span></div>
        <div><b>{taka(list.length ? Math.round(sum / list.length) : 0)}</b><span>গড় এন্ট্রি</span></div>
      </div>
      {(tab === "week" || tab === "month") && <Bars from={from} to={to} tab={tab} list={list} />}
      {!list.length ? <div className="empty">এই সময়ে কোনো কালেকশন নেই</div> : <>
        <h3>সদস্য অনুযায়ী</h3>
        {arr.map((r) => { const m = members.find((x) => x._id === r.mid); return (
          <div key={r.mid || r.n} className="row w"><div className="m"><div className="n">{r.n}</div></div>{m && <span className="no">নং {bn(m.no)}</span>}<div className="a">{taka(r.v)}</div><div className="pb"><i style={{ width: Math.round((r.v / top) * 100) + "%" }} /></div></div>); })}
        <h3>তারিখ অনুযায়ী</h3>
        {list.map((e) => { const head = e.paidDate !== last; last = e.paidDate; const [py, pmn] = e.paidMonth.split("-");
          const sub = [`${["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"][+pmn - 1]} ${bn(py)} এর দান`, e.receiptNo && "রশিদ নং " + bn(e.receiptNo), e.note].filter(Boolean).join(" • ");
          return (
            <div key={e._id}>
              {head && <div className="date" style={{ display: "flex", justifyContent: "space-between" }}><span>{bnDate(e.paidDate)}</span><span>{taka(dayTot[e.paidDate])}</span></div>}
              <div className="row"><div className="m"><div className="n">{e.memberName}</div><div className="s">{sub}</div></div><div className="a">{taka(e.amount)}</div>
                {admin && e.member && <button className="btn x" onClick={() => onEdit(e.member, e.paidMonth)}>সংশোধন</button>}</div>
            </div>); })}
      </>}
    </>
  );
}
