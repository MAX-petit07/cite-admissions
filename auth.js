// =====================================================
// auth.js — loaded on EVERY page (after supabase-config.js).
//
// What it does:
//   1. Creates the Supabase client (only with the PUBLISHABLE key).
//   2. Restores the saved login session when a page opens.
//   3. Reads the person's REAL role from the database table public.profiles
//      (never from anything the browser could have edited).
//   4. Updates the header ("Sign in" button -> your name) on every page.
//   5. Shares all of this with account.js through window.CiteAuth.
//
// TEMPORARY DEMO SETTING: email confirmation is switched OFF in Supabase so
// new accounts can log in straight away. Turn it back ON before real users.
// =====================================================
(function () {
  "use strict";

  var cfg = window.CITE_SUPABASE || {};
  var problem = ""; // set when the account system cannot start

  // ---------- 1. Safety checks, then create the client ----------
  // Refuse to start if a SECRET key was pasted into supabase-config.js by mistake.
  function looksSecret(key) {
    if (/^sb_secret_/.test(key)) return true;
    var parts = key.split(".");
    if (parts.length === 3) {
      try {
        var json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(json).role === "service_role";
      } catch (e) { /* not a readable token: fine */ }
    }
    return false;
  }

  var client = null;
  if (typeof cfg.url !== "string" || typeof cfg.publishableKey !== "string" ||
      !/^https:\/\/[^\s/]+\/?$/.test(cfg.url) || cfg.publishableKey.length < 20 ||
      /YOUR[_-]/i.test(cfg.url + cfg.publishableKey)) {
    problem = "config";
  } else if (looksSecret(cfg.publishableKey)) {
    problem = "secret-key"; // never use it
    console.error("[auth] A secret key is in supabase-config.js. Remove it and use the PUBLISHABLE key only.");
  } else if (!window.supabase || typeof window.supabase.createClient !== "function") {
    problem = "library"; // the CDN script did not load
  } else {
    try {
      client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
    } catch (e) {
      problem = "library";
      console.error("[auth] Could not create the Supabase client.", e);
    }
  }

  // ---------- 2. Shared state ----------
  var state = { ready: false, user: null, profile: null, profileFailed: false };
  var listeners = [];
  var counter = 0; // protects against two refreshes finishing in the wrong order

  function snapshot() {
    return { ready: state.ready, user: state.user, profile: state.profile, profileFailed: state.profileFailed };
  }
  function emit() {
    listeners.forEach(function (fn) {
      try { fn(snapshot()); } catch (e) { console.error(e); }
    });
  }

  // The four kinds of contributor. The key picks the badge style, the label is the text.
  // Everything here comes from the database row (public.profiles), never from the browser.
  function roleInfo(profile) {
    if (!profile) return { key: "unknown", label: "" };
    if (profile.role === "team") return { key: "team", label: "MANI Team" };
    if (profile.role === "student") return { key: "student", label: "Student" };
    return { key: "student", label: "Member" };
  }
  function roleLabel(profile) { return roleInfo(profile).label; }

  // Names that could be mistaken for the MANI team, CIUP or a moderator.
  // Used when registering (blocks them) and when showing names (hides them for non-team people).
  // Must stay in sync with public.is_reserved_name() in the database.
  var RESERVED_NAME = /\b(ciup|moderators?|admin(istrators?)?|staff|official)\b|\bmani\b.*\b(team|admin|staff|official|moderator)\b|\b(team|admin|staff|official|moderator)\b.*\bmani\b|\badmissions?\s+team\b/i;
  function isReservedName(name) {
    var plain = String(name || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")   // invisible characters
      .replace(/[_.\-·•|]+/g, " ");            // "MANI_Team" -> "MANI Team"
    return RESERVED_NAME.test(plain);
  }

  // ---------- 3. Load the real profile from the database ----------
  async function fetchProfile(userId) {
    try {
      var res = await client
        .from("profiles")
        .select("display_name, role, verified")
        .eq("id", userId)
        .maybeSingle();
      if (res.error) return { profile: null, failed: true };
      if (!res.data) return { profile: null, failed: true }; // no profile row found
      return {
        profile: {
          display_name: String(res.data.display_name || ""),
          role: String(res.data.role || ""),
          verified: res.data.verified === true,
        },
        failed: false,
      };
    } catch (e) {
      return { profile: null, failed: true };
    }
  }

  async function refresh() {
    var mine = ++counter;
    var session = null;
    if (client) {
      try {
        var r = await client.auth.getSession(); // restores the saved session
        session = r && r.data ? r.data.session : null;
      } catch (e) { session = null; }
    }
    if (mine !== counter) return;

    if (!session || !session.user) {
      state = { ready: true, user: null, profile: null, profileFailed: false };
    } else {
      var p = await fetchProfile(session.user.id);
      if (mine !== counter) return;
      state = { ready: true, user: session.user, profile: p.profile, profileFailed: p.failed };
    }
    renderHeader();
    emit();
  }

  // ---------- 4. Header: "Sign in" button, or the person's name ----------
  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text; // always plain text, never HTML
    return node;
  }

  function renderHeader() {
    var loggedIn = !!state.user;
    var pill = document.querySelector("[data-auth-link]");
    if (pill) pill.textContent = loggedIn ? "My account" : "Sign up";
    var slot = document.querySelector("[data-auth-slot]");
    var navItem = document.querySelector("[data-auth-nav]");

    if (slot) {
      slot.textContent = "";
      if (loggedIn) {
        var name = state.profile && state.profile.display_name ? state.profile.display_name : "Account";
        var link = make("a", "auth-chip");
        link.href = "account.html";
        var label = roleLabel(state.profile);
        link.setAttribute("aria-label", "My account: " + name + (label ? ", " + label : ""));
        var avatar = make("span", "auth-chip__avatar", name.charAt(0).toUpperCase());
        avatar.setAttribute("aria-hidden", "true");
        link.appendChild(avatar);
        link.appendChild(make("span", "auth-chip__name", name));
        slot.appendChild(link);
      } else {
        var signIn = make("a", "btn btn--ghost auth-btn", "Sign in");
        signIn.href = "account.html";
        slot.appendChild(signIn);
      }
    }
    if (navItem) navItem.textContent = loggedIn ? "My account" : "Sign in";
  }

  // ---------- 5. Listen for logins / logouts (also from other tabs) ----------
  if (client) {
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      if (event === "SIGNED_IN" && session && state.user && state.user.id === session.user.id && state.profile) return;
      // Never call Supabase directly inside this callback: wait one tick.
      setTimeout(refresh, 0);
    });
  }

  async function signOut() {
    if (!client) return { error: new Error("not-available") };
    var res = await client.auth.signOut({ scope: "local" });
    await refresh();
    return res;
  }

  // ---------- 6. What other scripts can use ----------
  window.CiteAuth = {
    client: client,
    available: !!client,
    problem: problem,
    roleLabel: roleLabel,
    roleInfo: roleInfo,
    isReservedName: isReservedName,
    refresh: refresh,
    signOut: signOut,
    state: snapshot,
    onChange: function (fn) {
      listeners.push(fn);
      if (state.ready) fn(snapshot());
    },
  };

  renderHeader();
  refresh();
})();
