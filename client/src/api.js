let token = localStorage.getItem("tk") || "";
export const setToken = (t) => { token = t; t ? localStorage.setItem("tk", t) : localStorage.removeItem("tk"); };
async function call(method, url, body) {
  const r = await fetch("/api" + url, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "ত্রুটি হয়েছে"), { status: r.status });
  return d;
}
export const api = { get: (u) => call("GET", u), post: (u, b) => call("POST", u, b), put: (u, b) => call("PUT", u, b), del: (u) => call("DELETE", u) };
