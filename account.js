// =====================================================
// account.js — only used by account.html
//   - switches between "Create account" and "Sign in"
//   - checks the forms and shows friendly errors
//   - calls Supabase Auth (through window.CiteAuth from auth.js)
//   - shows the signed-in view, with the REAL role from the database
//   - logout
// Everything people type is shown as plain text (textContent), never HTML.
// =====================================================
(function () {
  "use strict";

  var Auth = window.CiteAuth;
  if (!Auth) return;

  function $(id) { return document.getElementById(id); }

  // ---------- Which view is visible ----------
  var views = { loading: $("viewLoading"), unavailable: $("viewUnavailable"), out: $("viewOut"), inn: $("viewIn") };
  function showView(name) {
    Object.keys(views).forEach(function (key) { views[key].hidden = key !== name; });
  }

  // ---------- Messages (form-level) ----------
  function showMessage(el, text, kind) {
    el.textContent = text;
    el.className = "form-message" + (kind === "ok" ? " form-message--ok" : "");
    el.hidden = false;
  }
  function clearMessage(el) {
    el.textContent = "";
    el.hidden = true;
  }

  // ---------- Tabs: Sign in / Create account ----------
  var tabs = {
    signin: { tab: $("tabSignin"), panel: $("panelSignin") },
    register: { tab: $("tabRegister"), panel: $("panelRegister") },
  };
  var busy = false; // true while a request is running

  function selectTab(name, moveFocus) {
    if (busy) return;
    Object.keys(tabs).forEach(function (key) {
      var on = key === name;
      tabs[key].tab.setAttribute("aria-selected", String(on));
      tabs[key].tab.tabIndex = on ? 0 : -1;
      tabs[key].panel.hidden = !on;
    });
    clearMessage($("signinMsg"));
    clearMessage($("registerMsg"));
    if (moveFocus) tabs[name].tab.focus();
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* not important */ }
  }

  Object.keys(tabs).forEach(function (key) {
    tabs[key].tab.addEventListener("click", function () { selectTab(key, false); });
    // Arrow keys move between tabs (keyboard friendly)
    tabs[key].tab.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        selectTab(key === "signin" ? "register" : "signin", true);
      }
    });
  });
  document.querySelectorAll("[data-switch]").forEach(function (btn) {
    btn.addEventListener("click", function () { selectTab(btn.dataset.switch, true); });
  });

  // ---------- Field checks ----------
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(field, message) {
    var err = field.querySelector(".field__error");
    var inputs = field.querySelectorAll("input, select");
    if (!message) {
      err.hidden = true;
      err.textContent = "";
      field.classList.remove("is-invalid");
      inputs.forEach(function (i) { i.removeAttribute("aria-invalid"); });
      return true;
    }
    err.textContent = message;
    err.hidden = false;
    field.classList.add("is-invalid");
    inputs.forEach(function (i) { i.setAttribute("aria-invalid", "true"); });
    return false;
  }

  var checks = {
    name: function (v) {
      v = v.trim();
      if (!v) return "Please enter a display name.";
      if (v.length < 2) return "Your display name needs at least 2 characters.";
      if (v.length > 40) return "Your display name can have 40 characters at most.";
      if (Auth.isReservedName(v)) return "That name isn't allowed because it could be mistaken for the MANI team or CIUP. Please choose another one.";
      return "";
    },
    email: function (v) {
      v = v.trim();
      if (!v) return "Please enter your email address.";
      if (!EMAIL.test(v)) return "This email doesn't look right. Example: name@example.com";
      return "";
    },
    newPassword: function (v) {
      if (!v) return "Please choose a password.";
      if (v.length < 8) return "Your password needs at least 8 characters.";
      return "";
    },
    password: function (v) {
      return v ? "" : "Please enter your password.";
    },
  };

  // Check every field of a form. Returns true if all fields are fine.
  function validate(form) {
    var firstBad = null;
    form.querySelectorAll(".field[data-check]").forEach(function (field) {
      var input = field.querySelector("input");
      var ok = setError(field, checks[field.dataset.check](input.value));
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  // Re-check a field as soon as the person fixes it
  document.querySelectorAll(".field[data-check]").forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.classList.contains("is-invalid")) {
        setError(field, checks[field.dataset.check](field.querySelector("input").value));
      }
    });
  });

  // "Show / Hide" buttons for passwords
  document.querySelectorAll(".pw__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("aria-controls"));
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", String(show));
    });
  });

  // ---------- Friendly error messages ----------
  var MSG = {
    network: "We couldn't reach the server. Check your internet connection and try again.",
    timeout: "This is taking longer than expected. Check your connection and try again.",
    credentials: "That email and password don't match. Check them and try again.",
    notConfirmed: "Your email address isn't confirmed yet. Check your inbox for the confirmation link.",
    duplicate: "This email address already has an account. Try signing in instead.",
    weak: "That password is too weak. Use at least 8 characters, mixing letters and numbers.",
    badEmail: "That email address isn't accepted. Please check it.",
    rate: "Too many attempts. Please wait a few minutes and try again.",
    closed: "New sign-ups are closed right now.",
    server: "Something went wrong on our side. Please try again in a moment.",
    other: "Something went wrong. Please try again.",
  };

  function friendly(error) {
    var code = String((error && error.code) || "").toLowerCase();
    var text = String((error && error.message) || "").toLowerCase();
    var status = error && error.status;

    if (error && error.timedOut) return MSG.timeout;
    // The server answered with an error (500, 502, 503, 504...): our side, not the visitor's connection.
    if (typeof status === "number" && status >= 500) return MSG.server;
    // No answer at all: connection problem.
    if (!navigator.onLine || (error && error.name === "AuthRetryableFetchError") ||
        /failed to fetch|networkerror|network request failed|load failed/.test(text)) return MSG.network;
    if (code === "invalid_credentials" || /invalid login credentials/.test(text)) return MSG.credentials;
    if (code === "email_not_confirmed" || /email not confirmed/.test(text)) return MSG.notConfirmed;
    if (code === "user_already_exists" || code === "email_exists" || /already (been )?registered|already exists/.test(text)) return MSG.duplicate;
    if (code === "weak_password" || /password should|weak password|password is too/.test(text)) return MSG.weak;
    if (code === "email_address_invalid" || /email address .*invalid|invalid .*email/.test(text)) return MSG.badEmail;
    if (status === 429 || /rate limit|too many/.test(text) || /over_.*rate_limit/.test(code)) return MSG.rate;
    if (code === "signup_disabled" || /signups? (not allowed|disabled)/.test(text)) return MSG.closed;
    if (/database error|unexpected_failure/.test(text + " " + code) || (status && status >= 500)) return MSG.server;
    return MSG.other;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject({ timedOut: true, message: "timeout" }); }, ms);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  // ---------- Run a request with a loading state and NO double submits ----------
  async function runWithLoading(form, button, loadingText, task) {
    if (busy) return;
    busy = true;
    var original = button.textContent;
    var lock = form.querySelector(".lockable");
    button.disabled = true;
    button.textContent = loadingText;
    form.setAttribute("aria-busy", "true");
    if (lock) lock.disabled = true; // locks every field while we wait
    try {
      await task();
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = original;
      form.removeAttribute("aria-busy");
      if (lock) lock.disabled = false;
    }
  }

  var welcome = ""; // one-time message shown after creating an account

  // ---------- Create account ----------
  var regForm = $("registerForm");
  regForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var msg = $("registerMsg");
    clearMessage(msg);
    if (!validate(regForm)) return;

    var name = $("regName").value.trim();
    var email = $("regEmail").value.trim();
    var password = $("regPassword").value;
    // Everyone who signs up here is a student account. "team" is impossible from here,
    // and the database trigger ignores anything else anyway.
    var requestedRole = "student";

    runWithLoading(regForm, $("regSubmit"), "Creating account…", async function () {
      var result;
      try {
        result = await withTimeout(Auth.client.auth.signUp({
          email: email,
          password: password,
          options: { data: { display_name: name, requested_role: requestedRole } },
        }), 20000);
      } catch (err) {
        showMessage(msg, friendly(err));
        return;
      }
      if (result.error) {
        showMessage(msg, friendly(result.error));
        return;
      }
      var user = result.data && result.data.user;
      // When email confirmation is ON, an existing address comes back as a user with no identities.
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        showMessage(msg, MSG.duplicate);
        return;
      }
      if (!result.data.session) {
        // Only happens if email confirmation is switched on in Supabase.
        showMessage(msg, "Almost done! Check your inbox for a confirmation link, then sign in.", "ok");
        regForm.reset();
        return;
      }
      welcome = "Your account has been created. Welcome!";
      regForm.reset();
      await Auth.refresh(); // loads the profile and switches to the signed-in view
    });
  });

  // ---------- Sign in ----------
  var signinForm = $("signinForm");
  signinForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var msg = $("signinMsg");
    clearMessage(msg);
    if (!validate(signinForm)) return;

    var email = $("loginEmail").value.trim();
    var password = $("loginPassword").value;

    runWithLoading(signinForm, $("signinSubmit"), "Signing in…", async function () {
      var result;
      try {
        result = await withTimeout(Auth.client.auth.signInWithPassword({ email: email, password: password }), 20000);
      } catch (err) {
        showMessage(msg, friendly(err));
        return;
      }
      if (result.error) {
        showMessage(msg, friendly(result.error));
        return;
      }
      signinForm.reset();
      await Auth.refresh();
    });
  });

  // ---------- Signed-in view ----------
  var ROLE_NOTES = {
    student: "You have a student account.",
    team: "You are a member of the MANI Team.",
  };

  function renderSignedIn(s) {
    var profile = s.profile;
    $("accName").textContent = profile && profile.display_name ? profile.display_name : "there";
    $("accEmail").textContent = s.user.email || "";

    var badge = $("accRole");
    var note = $("accRoleNote");
    var problem = $("accProfileError");
    var key = "";
    if (profile) {
      var info = Auth.roleInfo(profile);
      key = info.key;
      badge.textContent = info.label;
      badge.className = "badge badge--" + info.key;
      note.textContent = ROLE_NOTES[key] || "";
      problem.hidden = true;
    } else {
      badge.textContent = "Unknown";
      badge.className = "badge badge--student";
      note.textContent = "";
      problem.hidden = false;
    }

    var accMsg = $("accMsg");
    if (welcome) {
      showMessage(accMsg, welcome, "ok");
      welcome = "";
    } else {
      clearMessage(accMsg);
    }
  }

  $("retryProfile").addEventListener("click", function () { Auth.refresh(); });

  // ---------- Logout ----------
  var signOutBtn = $("signOutBtn");
  signOutBtn.addEventListener("click", async function () {
    if (busy) return;
    busy = true;
    signOutBtn.disabled = true;
    signOutBtn.textContent = "Signing out…";
    var failed = false;
    try {
      var res = await withTimeout(Auth.signOut(), 20000);
      failed = !!(res && res.error && res.error.message === "not-available");
    } catch (err) {
      failed = true;
    }
    busy = false;
    signOutBtn.disabled = false;
    signOutBtn.textContent = "Sign out";
    if (failed) {
      showMessage($("accMsg"), "We couldn't sign you out. Please try again.");
    } else {
      selectTab("signin", false);
    }
  });

  // ---------- React to the login state (also when it changes in another tab) ----------
  function initialTab() {
    selectTab(location.hash === "#register" ? "register" : "signin", false);
  }

  // A link like account.html#register clicked while already on this page
  window.addEventListener("hashchange", function () {
    if (!views.out.hidden && !busy) initialTab();
  });

  Auth.onChange(function (s) {
    if (!Auth.available) {
      $("unavailableText").textContent =
        Auth.problem === "config" ? "The account system isn't configured yet: supabase-config.js needs the project URL and the publishable key."
        : Auth.problem === "secret-key" ? "A secret key was found in supabase-config.js. It has been ignored for your safety. Please use the publishable key only."
        : "We couldn't load the sign-in service. Check your internet connection and reload the page.";
      showView("unavailable");
      return;
    }
    if (!s.ready) return;
    if (s.user) {
      renderSignedIn(s);
      showView("inn");
    } else {
      var wasOut = !views.out.hidden;
      showView("out");
      if (!wasOut) initialTab();
    }
  });
})();
