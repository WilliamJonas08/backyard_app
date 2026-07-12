/* Tiny fetch wrapper around the JSON API.
   Admin / super-admin passwords are kept in sessionStorage (cleared when the
   browser closes) and sent as headers on protected calls. */

const API = (() => {
  const ADMIN_KEY = "backyard_admin_pw";
  const SUPER_KEY = "backyard_super_pw";

  const getAdminPw = () => sessionStorage.getItem(ADMIN_KEY) || "";
  const getSuperPw = () => sessionStorage.getItem(SUPER_KEY) || "";
  const setAdminPw = (pw) => sessionStorage.setItem(ADMIN_KEY, pw);
  const setSuperPw = (pw) => sessionStorage.setItem(SUPER_KEY, pw);
  const clearAdminPw = () => sessionStorage.removeItem(ADMIN_KEY);
  const clearSuperPw = () => sessionStorage.removeItem(SUPER_KEY);

  async function request(method, path, { body, admin, superadmin } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (admin) headers["X-Admin-Password"] = getAdminPw();
    if (superadmin) headers["X-Superadmin-Password"] = getSuperPw();

    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* empty body */
    }
    if (!res.ok) {
      const detail = data && data.detail ? data.detail : `Erreur ${res.status}`;
      throw new Error(typeof detail === "string" ? detail : "Requête invalide.");
    }
    return data;
  }

  return {
    // Public
    getEvent: () => request("GET", "/api/event"),
    getParticipants: () => request("GET", "/api/participants"),
    getParticipant: (id) => request("GET", `/api/participants/${id}`),
    register: (name) => request("POST", "/api/participants", { body: { name } }),
    getLeaderboard: () => request("GET", "/api/leaderboard"),
    getSeries: () => request("GET", "/api/series"),

    // Admin
    checkAdmin: () => request("GET", "/api/admin/auth/check", { admin: true }),
    recordResult: (body) =>
      request("POST", "/api/admin/results", { body, admin: true }),
    listResults: () => request("GET", "/api/admin/results", { admin: true }),

    // Super-admin
    checkSuper: () =>
      request("GET", "/api/admin/auth/check-super", { superadmin: true }),
    updateResult: (id, body) =>
      request("PUT", `/api/admin/results/${id}`, { body, superadmin: true }),
    deleteResult: (id) =>
      request("DELETE", `/api/admin/results/${id}`, { superadmin: true }),

    // Password helpers
    getAdminPw,
    getSuperPw,
    setAdminPw,
    setSuperPw,
    clearAdminPw,
    clearSuperPw,
  };
})();
