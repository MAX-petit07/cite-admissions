// MANI — Plan A, B and C from the quiz answers.
// Honest matching: it only uses what is verified in journey-data.js (official ciup.fr pages, checked 24 Nov 2026).
// Anything we have no data for is shown as "not verified yet" or "we can't match this yet", never guessed.
// All text is set with textContent (never innerHTML).
(function () {
  "use strict";
  const D = window.JOURNEY_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const link = (text, href, cls) => { const a = el("a", cls, text); a.href = href; if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; } return a; };

  // ---------- the saved quiz ----------
  let quiz = null;
  try { quiz = JSON.parse(localStorage.getItem("maniQuiz")); } catch (e) { quiz = null; }
  const A = quiz && quiz.answers ? quiz.answers : null;
  if (!D || !A || !quiz.done || !A.budget || !A.study || !A.nationality || !A.arrival) {
    $("#plansEmpty").hidden = false;
    return;
  }
  $("#plansBody").hidden = false;

  const BUDGET_LABEL = { u500: "Budget: under €500", "500-700": "Budget: €500 to €700", "700plus": "Budget: €700 or more", unsure: "Budget: not sure yet" };
  const PAYER_LABEL = { independent: "Independent", family: "Family pays", scholarship: "Scholarship", mix: "A mix" };
  const STUDY_LABEL = { master: "Master's", phd: "Doctorate / PhD", arts: "Arts programme", other: "Other studies" };
  const PREF_LABEL = { price: "Lowest price", bathroom: "Private bathroom", kitchen: "Shared kitchen", quiet: "Quiet place to study", lively: "Lively community", mycountry: "People from my country" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const BUDGET_MAX = { u500: 500, "500-700": 700, "700plus": Infinity, unsure: null };
  const prefs = Array.isArray(A.prefs) ? A.prefs : [];
  const country = A.nationality;
  const arrival = MONTHS[(A.arrival.month || 1) - 1] + " " + A.arrival.year;
  const septemberArrival = A.arrival.month === 9;

  const niceDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1] : "24 November 2026"; };

  // ---------- reading the data for one house ----------
  const textOf = (o) => [o.rawLine, o.features, o.roomType].filter(Boolean).join(" | ");
  const PRIVATE_BATH = /privativ|salle de bain individuelle|douches? à l[’']intérieur de la chambre|salle d[’']eau ou salle de bain intégrée/i;
  const SHARED_WORDS = /(douches?|wc|cuisines?)[^.|]{0,40}(collectif|commun|partag|étage)/i;
  const SHARED_KITCHEN = /cuisines?[^.|]{0,40}(commun|partag|collectif|étage)|(commun|partag|collectif)[^.|]{0,25}cuisine/i;
  const hasPrivateBathroom = (h) => (h.price.offers || []).some((o) => { const t = textOf(o); return PRIVATE_BATH.test(t) || (/douche/i.test(t) && /\bwc\b/i.test(t) && !SHARED_WORDS.test(t)); });
  const hasSharedKitchen = (h) => (h.price.offers || []).some((o) => SHARED_KITCHEN.test(textOf(o)));

  // The lowest listed price among the offers on the house page (the page often does not say "per month").
  function priceInfo(h) {
    const offers = h.price.offers || [];
    const current = offers.filter((o) => o.outdated !== true);
    const pool = current.length ? current : offers;
    const values = [];
    pool.forEach((o) => (o.amounts || []).forEach((a) => { if (a.kind !== "night" && typeof a.value === "number") values.push(a.value); }));
    if (!values.length) return { from: null };
    const validity = (pool.find((o) => o.validity) || {}).validity || null;
    return { from: Math.min.apply(null, values), validity, onlyOld: current.length === 0, someOld: !!h.price.someOlderThan2026 };
  }

  // ---------- candidates: our country's national house + houses whose route is not verified yet (never school houses) ----------
  const houses = D.houses.map((h) => ({ h, price: priceInfo(h), own: h.route.type === "national" && h.countries.some((c) => c.en === country) }));
  const candidates = houses.filter((x) => x.own || x.h.route.type === "unknown");
  const priced = candidates.filter((x) => x.price.from !== null).map((x) => x.price.from).sort((a, b) => a - b);
  const median = priced.length ? priced[Math.floor(priced.length / 2)] : null;
  const maxBudget = BUDGET_MAX[A.budget];
  const euro = (v) => "€" + (Math.round(v) === v ? v : v.toFixed(2));

  candidates.forEach((x) => {
    x.score = 0; x.yes = []; x.no = [];
    const countryFilter = (D.countries.find((c) => c.en === country) || {}).source;
    if (x.own) { x.score += 5; x.yes.push({ t: "National house for " + country + ": CIUP's official house list shows it for your country.", src: countryFilter }); }
    if (maxBudget !== null) {
      if (x.price.from === null) x.no.push({ t: "Price not verified yet: check the house page." });
      else if (x.price.from <= maxBudget) { x.score += 3; x.yes.push({ t: "Within your budget: the cheapest listed room is from " + euro(x.price.from) + " (house page" + (x.price.validity ? ", " + x.price.validity : "") + ")." }); }
      else x.no.push({ t: "Above your budget: the cheapest listed room is from " + euro(x.price.from) + "." });
    }
    if (prefs.includes("price") && x.price.from !== null && median !== null && x.price.from <= median) { x.score += 1; x.yes.push({ t: "Among the lower prices listed on the house pages." }); }
    if (prefs.includes("bathroom")) { if (hasPrivateBathroom(x.h)) { x.score += 2; x.yes.push({ t: "A room type lists its own shower and WC (check the house page)." }); } else x.no.push({ t: "The house page does not list a private bathroom." }); }
    if (prefs.includes("kitchen")) { if (hasSharedKitchen(x.h)) { x.score += 2; x.yes.push({ t: "A room type mentions a shared kitchen." }); } else x.no.push({ t: "The house page does not mention a shared kitchen." }); }
    if (prefs.includes("mycountry") && !x.own) x.no.push({ t: "This is not the national house for " + country + "." });
  });
  candidates.sort((a, b) => b.score - a.score || (a.price.from === null) - (b.price.from === null) || (a.price.from || 0) - (b.price.from || 0) || a.h.name.localeCompare(b.h.name));
  const meaningful = (x) => x && x.yes.length > 0;
  const planA = meaningful(candidates[0]) ? candidates[0] : null;
  const planB = meaningful(candidates[1]) ? candidates[1] : null;
  const cannot = ["quiet", "lively"].filter((k) => prefs.includes(k)).map((k) => PREF_LABEL[k]);

  // ---------- the 3 cards ----------
  const row = $("#planRow");
  function summary(letter, title, houseName, line, cls, tag) {
    const li = el("li", "plancard" + (cls ? " " + cls : ""));
    if (tag) li.appendChild(el("span", "plancard__tag", tag));
    li.appendChild(el("span", "plancard__badge", letter));
    li.appendChild(el("h2", "", title));
    li.appendChild(el("p", "plancard__house", houseName));
    li.appendChild(el("p", "", line));
    const a = link("See details ↓", "#plan-" + letter.toLowerCase(), "more");
    li.appendChild(a);
    return li;
  }
  row.appendChild(summary("A", "Plan A", planA ? planA.h.name : "[House to choose]", "Matches the most of your answers.", "plancard--a", "Best match"));
  row.appendChild(summary("B", "Plan B", planB ? planB.h.name : "[House to choose]", "Matches some of your answers.", ""));
  row.appendChild(summary("C", "Plan C", "A backup outside the Cité", "A safe backup if you have no offer in time.", ""));

  // ---------- your answers ----------
  const chips = $("#answersRow");
  chips.appendChild(el("span", "answers-row__label", "Your answers:"));
  [BUDGET_LABEL[A.budget], PAYER_LABEL[A.payer] || "", STUDY_LABEL[A.study], country, "Arrival: " + arrival].concat(prefs.map((p) => PREF_LABEL[p])).filter(Boolean).forEach((t) => chips.appendChild(el("span", "achip", t)));
  chips.appendChild(link("Change my answers", "quiz.html?edit=1", "change"));

  // ---------- the big cards ----------
  const details = $("#planDetails");
  const ARCH = "M8 44V22C8 13 15 6 24 6s16 7 16 16v22M16 44V24c0-5 3.5-9 8-9s8 4 8 9v20M24 15v29M4 44h40";
  function picture(letter, photo) {
    const box = el("div", "plandetail__pic");
    box.appendChild(el("span", "plandetail__letter", letter));
    if (photo) {
      const pic = document.createElement("picture");
      const src = document.createElement("source"); src.type = "image/webp"; src.srcset = "images/cite-arch-900.webp"; pic.appendChild(src);
      const img = document.createElement("img"); img.src = "images/cite-arch.jpg"; img.loading = "lazy"; img.alt = "Two students walking through a stone archway towards the Maison internationale at the Cité internationale universitaire de Paris";
      pic.appendChild(img); box.appendChild(pic);
    } else {
      const big = el("div", "big");
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 48 48"); svg.setAttribute("aria-hidden", "true");
      const p = document.createElementNS(ns, "path"); p.setAttribute("d", ARCH); svg.appendChild(p); big.appendChild(svg); box.appendChild(big);
    }
    return box;
  }
  function box(title, content) {
    const b = el("div", "infobox");
    b.appendChild(el("h4", "", title));
    if (typeof content === "string") b.appendChild(el("p", "", content)); else b.appendChild(content);
    return b;
  }
  function applyDateText() {
    return septemberArrival
      ? "For a September arrival, CIUP says to apply in April. Its English and French pages word this differently, so check with CIUP."
      : "No deadline: new residents are accepted throughout the academic year. With no offer 15 days before you arrive, the application is not accepted.";
  }

  function houseCard(letter, x) {
    const art = el("article", "plandetail" + (letter === "A" ? " plandetail--a" : ""));
    art.id = "plan-" + letter.toLowerCase();
    art.setAttribute("aria-labelledby", art.id + "-t");
    art.appendChild(picture(letter, letter === "A"));
    const body = el("div");
    if (!x) {
      const h2 = el("h2", "", "[House to choose]"); h2.id = art.id + "-t"; body.appendChild(h2);
      body.appendChild(el("p", "why", "We don't have enough verified information to name a house for your Plan " + letter + " yet. Browse the 48 houses on the official CIUP list and check each house page."));
      const links = el("div", "plandetail__links");
      links.appendChild(link("Browse the 48 houses", "maisons.html", "btn btn--dark"));
      body.appendChild(links);
      art.appendChild(body);
      return art;
    }
    const h = x.h;
    const h2 = el("h2", "", h.name); h2.id = art.id + "-t"; body.appendChild(h2);
    const why = el("div", "why");
    why.appendChild(el("h3", "", "Why it's your Plan " + letter));
    const ul = el("ul", "reasons");
    x.yes.forEach((r) => { const li = el("li", "", r.t); ul.appendChild(li); });
    x.no.forEach((r) => ul.appendChild(el("li", "no", r.t)));
    cannot.forEach((c) => ul.appendChild(el("li", "no", "We can't match “" + c + "” yet: our verified data has nothing on it.")));
    why.appendChild(ul);
    body.appendChild(why);

    const grid = el("div", "infoboxes");
    // price
    let priceText = "Price not verified yet: check the house page.";
    if (x.price.from !== null) priceText = "From " + euro(x.price.from) + " for the cheapest listed room (period not stated on the page" + (x.price.validity ? "; listed for " + x.price.validity : "") + ")." + (x.price.onlyOld ? " That price is from an older year." : x.price.someOld ? " Some prices on that page are from an older year." : "");
    grid.appendChild(box("Price", priceText));
    // route
    const hasOwnHouse = houses.some((y) => y.own);
    const routeText = x.own
      ? "National house: the house is your point of contact, and admission then covers the whole Cité."
      : hasOwnHouse
        ? "Not verified yet for this house. Your own route is the national house for " + country + " (see Plan A)."
        : "Not verified yet for this house. If no house represents your nationality, CIUP's route is the central admissions service.";
    grid.appendChild(box("How to apply", routeText));
    // documents and conditions
    const docs = el("div");
    docs.appendChild(el("p", "", h.extraDocuments && h.extraDocuments.status === "found" ? (h.extraDocuments.items || []).map((i) => i.text).join(" ") : "Not verified yet: no extra document is listed on the house page."));
    if (h.extraConditions && h.extraConditions.status === "found") (h.extraConditions.items || []).forEach((i) => docs.appendChild(el("p", "", "Extra condition on the house page: " + i.text)));
    grid.appendChild(box("Extra documents", docs));
    grid.appendChild(box("When to apply", applyDateText()));
    body.appendChild(grid);

    const links = el("div", "plandetail__links");
    links.appendChild(link("Official house page ↗", h.page.url, "link"));
    if (letter === "A") {
      const b = el("button", "btn btn--dark", "Add to my timeline →"); b.type = "button";
      b.addEventListener("click", () => {
        try { localStorage.setItem("maniPlanA", JSON.stringify({ name: h.name, url: h.page.url })); } catch (e) { /* storage blocked */ }
        location.href = "timeline.html#how-it-works";
      });
      links.appendChild(b);
    }
    body.appendChild(links);
    body.appendChild(el("p", "src", "Source: the house's page on ciup.fr, checked " + niceDate(h.page.checked) + "."));
    art.appendChild(body);
    return art;
  }
  details.appendChild(houseCard("A", planA));
  details.appendChild(houseCard("B", planB));

  // Plan C: outside the Cité (general options only, no prices)
  const c = el("article", "plandetail");
  c.id = "plan-c"; c.setAttribute("aria-labelledby", "plan-c-t");
  c.appendChild(picture("C", false));
  const cb = el("div");
  const ch = el("h2", "", "A backup outside the Cité"); ch.id = "plan-c-t"; cb.appendChild(ch);
  const cwhy = el("div", "why");
  cwhy.appendChild(el("h3", "", "Why you need a Plan C"));
  const ru = el("ul", "reasons");
  ru.appendChild(el("li", "", "Official rule: if you have no accommodation offer 15 days before your desired arrival date, your application has not been accepted."));
  ru.appendChild(el("li", "", "So keep a backup ready while you wait for CIUP's answer."));
  cwhy.appendChild(ru);
  cb.appendChild(cwhy);
  const cg = el("div", "infoboxes");
  const crous = el("div"); const cp = el("p"); cp.appendChild(link("CROUS student residences (official CROUS site ↗)", "https://www.crous-paris.fr/", "link")); crous.appendChild(cp);
  cg.appendChild(box("Student residences", crous));
  cg.appendChild(box("Private options", "Private student residences, private rentals and flat-shares."));
  cg.appendChild(box("Prices", "Not shown here: check each option's own page."));
  cg.appendChild(box("When to look", "Start now, in parallel with your CIUP application."));
  cb.appendChild(cg);
  const cl = el("div", "plandetail__links");
  cl.appendChild(link("Official rule on ciup.fr ↗", "https://www.ciup.fr/en/apply-for-accommodation/", "link"));
  cb.appendChild(cl);
  cb.appendChild(el("p", "src", "Source for the 15-day rule: ciup.fr, checked 10 November 2026. The CROUS link is a general pointer, not a CIUP source."));
  c.appendChild(cb);
  details.appendChild(c);
})();
