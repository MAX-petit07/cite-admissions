// MANI — app-style homepage: a sidebar and one step at a time.
// Plain JavaScript, no libraries. All text is set with textContent (never innerHTML).

// ===== Top bar (every page): phone menu, and on the homepage it turns solid when you scroll past the photo =====
(function () {
  // "Sign up" becomes "My account" when a saved login exists (we only look at the browser's storage here, no request is made)
  try {
    const signed = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
    const link = document.querySelector("[data-auth-link]");
    if (signed && link) link.textContent = "My account";
  } catch (e) { /* storage blocked */ }
  const bar = document.getElementById("topbar");
  const btn = document.getElementById("menuBtn");
  const nav = document.getElementById("topnav");
  if (btn && nav) {
    const close = (back) => { nav.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); if (back) btn.focus(); };
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) close(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) close(true); });
  }
  const hero = document.getElementById("top");
  if (bar && hero && bar.classList.contains("topbar--hero")) {
    let wait = false;
    const update = () => { wait = false; bar.classList.toggle("is-solid", window.scrollY > hero.offsetHeight - bar.offsetHeight - 8 || (nav && nav.classList.contains("is-open"))); };
    window.addEventListener("scroll", () => { if (!wait) { wait = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    if (btn) btn.addEventListener("click", update);
    update();
  }
})();

(function () {
  const nav = document.getElementById("stepsNav");
  if (!nav) return; // not the homepage

  // ---------- saved state (the same key the old timeline used, so current users keep their ticks) ----------
  const KEY = "citeAdmissionsProgress"; // list of finished steps: "1".."4"
  const CHK = "maniChecklist";          // ticked checklist items
  const CUR = "maniStep";               // the step you were on
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the app still works for this visit */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  // Old timeline ids -> new step numbers
  const OLD = { eligibility: "1", submit: "3", response: "4" };
  const migrate = (list) => {
    if (!Array.isArray(list)) return [];
    const out = [];
    list.forEach((id) => { const n = OLD[id] || id; if (["1", "2", "3", "4"].includes(n) && !out.includes(n)) out.push(n); });
    return out;
  };
  let done = migrate(store.get(KEY, []));
  if (JSON.stringify(done) !== JSON.stringify(store.get(KEY, []))) store.set(KEY, done);
  let checks = store.get(CHK, []);
  if (!Array.isArray(checks)) checks = [];

  // ---------- page parts ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const views = {};
  $$(".view").forEach((v) => { views[v.dataset.view] = v; });
  const navBtns = $$(".nav-step");
  const glide = $("#glide");
  const stage = $("#content");
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Address (#hash) <-> view
  const HASH = { welcome: "welcome", "who-can-apply": "1", "how-it-works": "2", "key-facts": "3", guide: "3", "plan-b": "4", planb: "4", faq: "faq" };
  const CANON = { welcome: "welcome", 1: "who-can-apply", 2: "how-it-works", 3: "key-facts", 4: "plan-b", faq: "faq" };
  const viewFromHash = (h) => HASH[(h || "").replace(/^#/, "")] || null;

  let current = "welcome";
  let lastStep = "1"; // where "Back" from the FAQ returns to

  const isReturning = () => done.length > 0 || checks.length > 0 || ["1", "2", "3", "4"].includes(store.get(CUR, "welcome"));

  // ---------- drawing the state ----------
  const setBar = (el, n) => { el.setAttribute("aria-valuenow", String(n)); el.firstElementChild.style.setProperty("--p", String(n / 4)); };
  const STATE = { done: "Done", current: "Current step", todo: "Not done yet" };

  function moveGlide() {
    const row = current >= "1" && current <= "4" && current.length === 1 ? navBtns[Number(current) - 1].parentElement : null;
    if (!row) { glide.style.opacity = "0"; return; }
    glide.style.height = row.offsetHeight + "px";
    glide.style.setProperty("--y", row.offsetTop + "px");
    glide.style.opacity = "1";
  }

  function render() {
    navBtns.forEach((b) => {
      const n = b.dataset.step;
      const isDone = done.includes(n);
      b.classList.toggle("is-done", isDone);
      if (n === current) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      $(".nav-step__state", b).textContent = (isDone ? STATE.done : n === current ? STATE.current : STATE.todo) + (isDone && n === current ? ", current step" : "");
    });
    setBar($("#sideBar"), done.length);
    setBar($("#mobileBar"), done.length);
    $("#sideCount").textContent = done.length === 4 ? "All 4 done ✓" : done.length + " of 4 done";
    const label = $("#mobileLabel");
    if (current >= "1" && current <= "4" && current.length === 1) label.textContent = "Step " + current + " of 4 · " + $(".nav-step__title", navBtns[Number(current) - 1]).textContent;
    else if (current === "faq") label.textContent = "Quick answers · " + done.length + " of 4 done";
    else label.textContent = "Your application · " + done.length + " of 4 done";
    moveGlide();

    // checklist status (also the empty state)
    const n = checks.length;
    $("#clStatus").textContent = n === 0 ? "Nothing ticked yet. Start with your ID copy." : n === 4 ? "All ticked. Next: tell us when you've applied." : n + " of 4 ready";

    // step 4 message
    const banner = $("#allDone");
    if (done.includes("4")) {
      const all = done.length === 4;
      $(".alldone__title", banner).textContent = all ? "You're all set! Keep an eye on your email." : "Step 4 is marked as done.";
      $("p:not(.alldone__title)", banner).textContent = all
        ? "This only finishes your checklist, not your application."
        : "Some earlier steps are still open. You can open them from the list. This is only your own checklist, not your application.";
      banner.hidden = false;
    } else banner.hidden = true;
  }

  // ---------- changing step ----------
  function swap(fn) {
    if (!reduced() && document.startViewTransition) {
      const t = document.startViewTransition(fn);
      // a quick second click skips the first transition: that is fine, so we silence the browser's "skipped" errors
      [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p && p.catch(() => {}));
      return;
    }
    fn();
    if (!reduced()) {
      const v = views[current];
      v.classList.add("is-entering");
      v.addEventListener("animationend", () => v.classList.remove("is-entering"), { once: true });
    }
  }

  function show(view, opts = {}) {
    if (!views[view]) view = "welcome";
    const push = opts.push !== false;
    closeSheet(false);
    hideWelcomeBack();
    swap(() => {
      Object.keys(views).forEach((k) => views[k].classList.toggle("is-active", k === view));
      current = view;
      if (view.length === 1) { lastStep = view; store.set(CUR, view); }
      render();
      if (opts.focus !== false) {
        const t = $(".view__title, h1", views[view]);
        if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); }
      }
      if (opts.scroll !== false) {
        // bring the card to the top of the screen (also when you come down from the photo hero)
        const top = stage.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 1000 ? 136 : 96);
        if (Math.abs(window.scrollY - top) > 8) window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? "auto" : "smooth" });
      }
    });
    if (push) {
      const h = "#" + CANON[view];
      if (location.hash !== h) history.pushState(null, "", h);
    }
  }

  // ---------- marking steps done ----------
  function markDone(n) {
    if (done.includes(n)) return;
    done.push(n);
    done.sort();
    store.set(KEY, done);
    const b = navBtns[Number(n) - 1];
    b.classList.add("just-done");
    $(".nav-step__mark", b).addEventListener("animationend", () => b.classList.remove("just-done"), { once: true });
    if (done.length === 4) setTimeout(confetti, 150);
  }

  document.addEventListener("click", (e) => {
    const next = e.target.closest("[data-next]");
    if (next) {
      const n = next.dataset.next;
      markDone(n);
      if (n === "4") { render(); const b = $("#allDone"); if (b && !b.hidden) b.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); }
      else show(String(Number(n) + 1));
      return;
    }
    if (e.target.closest("[data-back]")) {
      if (current === "faq") show(isReturning() ? lastStep : "welcome");
      else show(current === "1" ? "welcome" : String(Number(current) - 1));
      return;
    }
    const step = e.target.closest(".nav-step");
    if (step) { show(step.dataset.step); return; }

    // any link that points at a view (chips, the welcome button, FAQ in the top bar, links from other pages' hashes)
    const a = e.target.closest("a[href^='#']");
    if (a && !e.defaultPrevented && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      const v = viewFromHash(a.getAttribute("href"));
      if (v) { e.preventDefault(); show(v); }
    }
  });

  window.addEventListener("popstate", () => { const v = viewFromHash(location.hash); show(v || "welcome", { push: false }); });
  window.addEventListener("hashchange", () => { const v = viewFromHash(location.hash); if (v && v !== current) show(v, { push: false }); });

  // ---------- checklist ----------
  $$("[data-check]").forEach((box) => {
    box.checked = checks.includes(box.dataset.check);
    box.addEventListener("change", () => {
      checks = $$("[data-check]").filter((b) => b.checked).map((b) => b.dataset.check);
      store.set(CHK, checks);
      render();
    });
  });

  // ---------- returning visitor ----------
  const wb = $("#welcomeBack");
  function showWelcomeBack(step) {
    $("#wbText").textContent = done.length === 4 ? "Welcome back! All 4 steps are done." : "Welcome back, you're on Step " + step + ". Keep going!";
    $("#wbConfirm").hidden = true;
    $("#wbActions").hidden = false;
    wb.hidden = false;
  }
  function hideWelcomeBack() { wb.hidden = true; }
  $("#startOver").addEventListener("click", () => { $("#wbActions").hidden = true; $("#wbConfirm").hidden = false; $("#startOverYes").focus(); $("#wbText").textContent = "Start over?"; });
  $("#startOverNo").addEventListener("click", () => { $("#wbConfirm").hidden = true; $("#wbActions").hidden = false; $("#wbText").textContent = "Welcome back, you're on Step " + current + ". Keep going!"; $("#startOver").focus(); });
  $("#startOverYes").addEventListener("click", () => {
    done = []; checks = [];
    store.del(KEY); store.del(CHK); store.del(CUR);
    $$("[data-check]").forEach((b) => { b.checked = false; });
    show("welcome");
  });

  // ---------- phone: bottom sheet ----------
  const sheet = $("#sidebar");
  const sheetBtn = $("#sheetBtn");
  const backdrop = $("#sheetBackdrop");
  const small = window.matchMedia("(max-width: 999px)");
  $("#mobilebar").hidden = false;
  function setInert() { if (small.matches && !sheet.classList.contains("is-open")) sheet.setAttribute("inert", ""); else sheet.removeAttribute("inert"); }
  function openSheet() {
    sheet.classList.add("is-open");
    sheet.removeAttribute("inert");
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add("is-shown"));
    sheetBtn.setAttribute("aria-expanded", "true");
    moveGlide();
    setTimeout(() => (navBtns.find((b) => b.getAttribute("aria-current")) || navBtns[0]).focus(), 50);
  }
  function closeSheet(returnFocus) {
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open");
    backdrop.classList.remove("is-shown");
    setTimeout(() => { backdrop.hidden = true; }, 300);
    sheetBtn.setAttribute("aria-expanded", "false");
    setInert();
    if (returnFocus) sheetBtn.focus();
  }
  sheetBtn.addEventListener("click", () => (sheet.classList.contains("is-open") ? closeSheet(true) : openSheet()));
  $("#sheetClose").addEventListener("click", () => closeSheet(true));
  backdrop.addEventListener("click", () => closeSheet(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("is-open")) closeSheet(true); });
  small.addEventListener("change", () => { closeSheet(false); setInert(); });
  setInert();

  // ---------- confetti: a short burst in our colours (hand-written, about 1 second) ----------
  function confetti() {
    if (reduced()) return;
    const cv = $("#confetti");
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = ["--mint", "--midnight", "--green", "--mint"].map((v) => css.getPropertyValue(v).trim());
    const bits = Array.from({ length: 90 }, (_, i) => ({
      x: W / 2 + (Math.random() - .5) * W * .25, y: H * .62,
      vx: (Math.random() - .5) * 14 * dpr, vy: -(6 + Math.random() * 12) * dpr,
      w: (6 + Math.random() * 6) * dpr, h: (4 + Math.random() * 5) * dpr,
      r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[i % colors.length],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / 1100;
      ctx.clearRect(0, 0, W, H);
      if (k >= 1) return;
      ctx.globalAlpha = k < .6 ? 1 : 1 - (k - .6) / .4;
      bits.forEach((b) => {
        b.vy += .5 * dpr; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= .99;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      });
      requestAnimationFrame(frame);
    })(t0);
  }

  // ---------- Plan A from the quiz ----------
  const planNote = $("#planANote");
  if (planNote) {
    const plan = store.get("maniPlanA", null);
    if (plan && typeof plan.name === "string") {
      $("span", planNote).textContent = plan.name + " (from your quiz answers). This is guidance, not an admission decision.";
      planNote.hidden = false;
    }
  }

  // ---------- opening the page ----------
  const fromHash = viewFromHash(location.hash);
  let first;
  if (fromHash) first = fromHash;
  else if (isReturning()) {
    const saved = store.get(CUR, null);
    first = ["1", "2", "3", "4"].includes(saved) ? saved : (["1", "2", "3", "4"].find((n) => !done.includes(n)) || "4");
  } else first = "welcome";
  Object.keys(views).forEach((k) => views[k].classList.toggle("is-active", k === first));
  current = first;
  if (first.length === 1) lastStep = first;
  render();
  if (isReturning() && first.length === 1) showWelcomeBack(first);
  window.addEventListener("load", moveGlide); // fonts can change the row heights
  window.addEventListener("resize", moveGlide);
})();

// ===== Maisons page: search box filters the cards by name =====
const search = document.getElementById("maisonSearch");
if (search) {
  const cards = document.querySelectorAll(".maison-card");
  const count = document.getElementById("maisonCount");
  const empty = document.getElementById("maisonEmpty");
  // Lower-case and remove accents, so "ile" finds "Île"
  const clean = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  search.addEventListener("input", () => {
    const q = clean(search.value.trim());
    let shown = 0;
    cards.forEach((card) => {
      const match = clean(card.dataset.name).includes(q);
      card.hidden = !match;
      if (match) shown++;
    });
    count.textContent = `Showing ${shown} of ${cards.length} houses`;
    empty.hidden = shown !== 0;
  });
}
