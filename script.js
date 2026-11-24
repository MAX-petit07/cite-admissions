// ===== Fade-up when sections scroll into view =====
// If the visitor prefers reduced motion (or the browser is old), everything is shown at once.
try {
  const items = document.querySelectorAll(".reveal");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target); // animate only once
          }
        });
      },
      { threshold: 0.05 }
    );
    items.forEach((el) => io.observe(el));
  }
} catch (e) {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
}

// ===== Mobile menu =====
document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("nav").classList.toggle("is-open");
});

// ===== Timeline: tick off steps, saved in the browser =====
const STORAGE_KEY = "citeAdmissionsProgress";
const steps = document.querySelectorAll(".step");

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveProgress(doneIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doneIds));
  } catch {
    /* storage not available — progress just won't be saved */
  }
}

let done = loadProgress();

// The little "2/5" badge on the "My progress" tab (homepage only)
const progressBadge = document.getElementById("progressBadge");
const progressBadgeText = document.getElementById("progressBadgeText");
function updateProgressBadge() {
  if (!progressBadge) return;
  const ids = Array.from(steps).map((s) => s.dataset.id);
  const n = done.filter((id) => ids.includes(id)).length;
  const all = ids.length > 0 && n === ids.length;
  progressBadge.textContent = all ? "✓" : n + "/" + ids.length; // ✓ when everything is ticked
  if (progressBadgeText) progressBadgeText.textContent = all ? "All " + ids.length + " steps done" : n + " of " + ids.length + " steps done";
}

function render() {
  let currentFound = false;
  steps.forEach((step) => {
    const isDone = done.includes(step.dataset.id);
    step.classList.toggle("is-done", isDone);
    step.querySelector(".step__date").dataset.status = isDone ? "done" : "";
    // The first step that isn't done is the "current" one
    const isCurrent = !isDone && !currentFound;
    if (isCurrent) currentFound = true;
    step.classList.toggle("is-current", isCurrent);
  });
  updateProgressBadge();
}

steps.forEach((step) => {
  step.querySelector(".step__dot").addEventListener("click", () => {
    const id = step.dataset.id;
    done = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    saveProgress(done);
    render();
  });
});

render();

// ===== Homepage: one card with five tabs =====
// Without JavaScript every panel simply shows one after another (the tab bar stays hidden).
(function () {
  const hub = document.getElementById("hub");
  if (!hub) return; // only the homepage has the hub

  const tablist = hub.querySelector('[role="tablist"]');
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const ids = tabs.map((t) => t.getAttribute("aria-controls"));
  const panels = ids.map((id) => document.getElementById(id));
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior = () => (reduceMotion() ? "auto" : "smooth");
  let current = null;

  panels.forEach((p) => p.setAttribute("tabindex", "-1")); // so a panel can receive focus from a link or "Next"

  // On a phone the tab bar scrolls sideways: keep the chosen tab in view
  function revealTab(tab) {
    if (tablist.scrollWidth <= tablist.clientWidth) return;
    const left = tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2;
    tablist.scrollTo({ left: Math.max(0, left), behavior: behavior() });
  }

  function scrollToHub() {
    hub.scrollIntoView({ behavior: behavior(), block: "start" });
  }

  // Open one tab and hide the others
  function select(id, opts) {
    opts = opts || {};
    const index = ids.indexOf(id);
    if (index < 0) return;
    const changed = current !== id;
    tabs.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === index));
      t.tabIndex = i === index ? 0 : -1; // only the selected tab is reachable with Tab
    });
    panels.forEach((p, i) => {
      p.hidden = i !== index;
      p.classList.remove("is-entering");
    });
    if (changed && current !== null && !reduceMotion()) {
      const p = panels[index];
      void p.offsetWidth; // restart the short fade-up
      p.classList.add("is-entering");
    }
    current = id;
    revealTab(tabs[index]);
    if (opts.hash !== false) {
      const h = typeof opts.hash === "string" ? opts.hash : "#" + id;
      try { history.replaceState(null, "", location.pathname + location.search + h); } catch (e) { /* not important */ }
    }
    if (opts.focus === "tab") tabs[index].focus();
    if (opts.focus === "panel") panels[index].focus({ preventScroll: true });
    if (opts.scroll === "hub") scrollToHub();
    if (opts.scroll === "target" && opts.target) opts.target.scrollIntoView({ behavior: behavior(), block: "start" });
  }

  // "#guide", "#planb"... -> which panel (and which element inside it)?
  function resolve(hash) {
    let id = "";
    try { id = decodeURIComponent(String(hash || "").replace(/^#/, "")); } catch (e) { return null; }
    if (!id) return null;
    if (ids.includes(id)) return { panelId: id, target: null };
    const el = document.getElementById(id);
    const panel = el && el.closest(".tabpanel");
    return panel ? { panelId: panel.id, target: el } : null;
  }

  // Clicking a tab
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      select(ids[i], { focus: "tab" });
      if (hub.getBoundingClientRect().top < 0) scrollToHub(); // you had scrolled past the top: bring the panel back
    });
  });

  // Arrow keys, Home and End move between tabs
  tablist.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n === null) return;
    e.preventDefault();
    select(ids[n], { focus: "tab" });
  });

  // "Next: ..." buttons
  hub.querySelectorAll("[data-goto]").forEach((b) => {
    b.addEventListener("click", () => select(b.dataset.goto, { focus: "panel", scroll: "hub" }));
  });

  // Any link to one of the panels (hero buttons, the question rows, the menu, ...) opens its tab
  const clean = (p) => p.replace(/index\.html$/, "");
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    const url = new URL(a.href, location.href);
    if (!url.hash || url.origin !== location.origin || clean(url.pathname) !== clean(location.pathname)) return;
    const hit = resolve(url.hash);
    if (!hit) return;
    e.preventDefault();
    select(hit.panelId, { hash: url.hash, focus: "panel", scroll: hit.target ? "target" : "hub", target: hit.target });
    const nav = document.getElementById("nav");
    if (nav) nav.classList.remove("is-open"); // close the phone menu
  });

  // Back / forward, or someone editing the address
  window.addEventListener("hashchange", () => {
    const hit = resolve(location.hash);
    if (hit) select(hit.panelId, { hash: false, scroll: hit.target ? "target" : "hub", target: hit.target });
  });

  // Opening the page: show the tab named in the address, or the first one
  const first = resolve(location.hash);
  select(first ? first.panelId : ids[0], { hash: false });
  if (first) {
    // jump (no animation) so the page opens right on the hub
    const jump = () => (first.target || hub).scrollIntoView({ behavior: "auto", block: "start" });
    let userScrolled = false;
    const mark = () => { userScrolled = true; };
    window.addEventListener("wheel", mark, { once: true, passive: true });
    window.addEventListener("touchmove", mark, { once: true, passive: true });
    window.addEventListener("keydown", mark, { once: true });
    requestAnimationFrame(jump);
    // web fonts and images can shift the layout a little after the first jump: re-aim once, unless the visitor already moved
    window.addEventListener("load", () => { if (!userScrolled) jump(); });
  }
})();

// ===== AI assistant (placeholder — not connected to a real AI yet) =====
const form = document.getElementById("askForm");
const input = document.getElementById("askInput");
const log = document.getElementById("chatLog");

function addMessage(text, who, link) {
  const div = document.createElement("div");
  div.className = `msg msg--${who}`;
  div.textContent = text;
  // Optional "official source" link under the answer
  if (link) {
    const a = document.createElement("a");
    a.href = link.url;
    a.textContent = link.label + " →";
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "msg__link";
    div.appendChild(document.createElement("br"));
    div.appendChild(a);
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// Answers for the 3 suggestion buttons. Every sentence comes from ciup-verified-info.md.
const ANSWERS = {
  criteria: {
    text:
      "Students need to be enrolled in a Master's or doctorate (Bac+4 or equivalent) at a French public or private higher-education institution, preferably in Île-de-France. Arts students can apply once their programme has reached 3 years of higher education. Researchers, artists and (exceptionally) passing guests have their own conditions, and some houses add extra conditions on their own pages.",
    link: { label: "Official source: Apply for accommodation", url: "https://www.ciup.fr/en/apply-for-accommodation/" },
  },
  response: {
    text:
      "CIUP sends the result by email, whatever the outcome. Admissions committees meet several times a year, and no general processing time is published. If you have no accommodation offer 15 days before your desired arrival date, your application has not been accepted.",
    link: { label: "Official source: Apply for accommodation", url: "https://www.ciup.fr/en/apply-for-accommodation/" },
  },
  maison: {
    text:
      "I can't tell you which house is best, because ciup.fr doesn't publish per-house details on its list page. There are three routes: a school house (for example AgroParisTech or Arts et Métiers students), a national house (for nationalities represented by a house), or the central admissions service for everyone else. Open a house's official page to see its own conditions.",
    link: { label: "Official source: list of houses", url: "https://www.ciup.fr/maisons-liste/" },
  },
};

// Only run on pages that have the assistant box (maisons.html doesn't)
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage(question, "user");
    input.value = "";
    setTimeout(() => {
      addMessage(
        "Thanks for your question! The assistant isn't connected yet. In the meantime, please check the official CIUP website: www.ciup.fr",
        "bot"
      );
    }, 500);
  });

  // Suggestion chips: show the question, then the answer from ANSWERS
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const answer = ANSWERS[chip.dataset.key];
      addMessage(chip.textContent, "user");
      setTimeout(() => addMessage(answer.text, "bot", answer.link), 300);
    });
  });
}

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
