// Jourdan — the quiz: 6 questions, one per screen. Answers are saved in this browser (localStorage).
// All text is set with textContent (never innerHTML).
(function () {
  "use strict";
  const KEY = "maniQuiz";
  const TOTAL = 6;

  // The names of the 31 countries that have a national house on ciup.fr are written exactly as in journey-data.js,
  // so the plans page can compare them (for example "Korea" is how CIUP names it).
  const COUNTRIES = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Côte d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Korea", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe", "Antigua and Barbuda", "Dominica", "Grenada", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "Palau", "Samoa", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "San Marino", "São Tomé and Príncipe", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu", "Vatican City"];
  COUNTRIES.sort((a, b) => a.localeCompare(b, "en"));
  COUNTRIES.push("Other / stateless");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let data = { answers: {}, step: 1, done: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === "object" && saved.answers) data = { answers: saved.answers, step: Number(saved.step) || 1, done: saved.done === true };
  } catch (e) { /* no saved answers */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked */ } };
  if (new URLSearchParams(location.search).get("edit") === "1") { data.done = false; data.step = 1; save(); }

  const form = $("#quizForm");
  const steps = $$(".qstep");
  const A = data.answers;

  // ---------- build the country list, the month and the year pickers ----------
  const list = $("#countryList");
  COUNTRIES.forEach((name) => {
    const label = document.createElement("label");
    label.className = "answer";
    const input = document.createElement("input");
    input.type = "radio"; input.name = "nationality"; input.value = name;
    const mark = document.createElement("span");
    mark.className = "answer__mark"; mark.setAttribute("aria-hidden", "true");
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS(svgNS, "path"); path.setAttribute("d", "m5 12.5 4.5 4.5L19 7.5");
    svg.appendChild(path); mark.appendChild(svg);
    const text = document.createElement("span"); text.textContent = name;
    label.append(input, mark, text);
    list.appendChild(label);
  });
  const month = $("#arrMonth"), year = $("#arrYear");
  MONTHS.forEach((m, i) => { const o = document.createElement("option"); o.value = String(i + 1); o.textContent = m; month.appendChild(o); });
  [2026, 2027, 2028].forEach((y) => { const o = document.createElement("option"); o.value = String(y); o.textContent = String(y); year.appendChild(o); });

  // ---------- put saved answers back ----------
  function restore() {
    ["budget", "payer", "study", "nationality"].forEach((k) => {
      const el = $(`input[name="${k}"][value="${CSS.escape(A[k] || "")}"]`);
      if (el) el.checked = true;
    });
    (A.prefs || []).forEach((v) => { const el = $(`input[name="prefs"][value="${v}"]`); if (el) el.checked = true; });
    if (A.arrival) { month.value = String(A.arrival.month || ""); year.value = String(A.arrival.year || ""); }
    updateNotes();
  }

  function collect() {
    ["budget", "payer", "study", "nationality"].forEach((k) => {
      const el = $(`input[name="${k}"]:checked`);
      if (el) A[k] = el.value; else delete A[k];
    });
    A.prefs = $$('input[name="prefs"]:checked').map((e) => e.value);
    if (month.value && year.value) A.arrival = { month: Number(month.value), year: Number(year.value) };
    else if (month.value || year.value) A.arrival = { month: Number(month.value) || 0, year: Number(year.value) || 0 };
    else delete A.arrival;
  }

  function updateNotes() {
    $("#payerNote").hidden = !(A.payer === "scholarship" || A.payer === "mix");
    $("#studyNote").hidden = A.study !== "other";
  }

  // ---------- showing a step ----------
  function show(n, focus = true) {
    data.step = n; save();
    steps.forEach((s) => s.classList.toggle("is-active", Number(s.dataset.q) === n));
    $("#qcount").textContent = "Question " + n + " of " + TOTAL;
    const track = $("#qtrack");
    track.setAttribute("aria-valuenow", String(n));
    track.firstElementChild.style.setProperty("--p", String(n / TOTAL));
    $("#qBack").hidden = n === 1;
    $("#qNext").textContent = n === TOTAL ? "See my result →" : "Next →";
    $$(".qerror").forEach((e) => { e.hidden = true; });
    if (focus) {
      const h = $(`.qstep[data-q="${n}"] h2`);
      if (h) h.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    }
  }

  function showResult() {
    $("#quizForm").hidden = true;
    $("#qprogress").hidden = true;
    $("#qresult").hidden = false;
    $("#qSign").hidden = false;
    const h = $("#qrt");
    if (h) h.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  }

  function problem(n) {
    if (n === 1 && !A.budget) return "Choose an answer to continue.";
    if (n === 2 && !A.payer) return "Choose an answer to continue.";
    if (n === 3 && !A.study) return "Choose an answer to continue.";
    if (n === 4 && !A.nationality) return "Choose your country to continue.";
    if (n === 5 && !(A.arrival && A.arrival.month && A.arrival.year)) return "Choose a month and a year to continue.";
    return "";
  }

  // ---------- events ----------
  form.addEventListener("change", () => { collect(); updateNotes(); save(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    collect(); save();
    const n = data.step;
    const msg = problem(n);
    const err = $(`.qstep[data-q="${n}"] .qerror`);
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    err.hidden = true;
    if (n < TOTAL) show(n + 1);
    else { data.done = true; save(); showResult(); }
  });
  $("#qBack").addEventListener("click", () => { collect(); save(); if (data.step > 1) show(data.step - 1); });
  $("#qRestart").addEventListener("click", () => {
    data = { answers: {}, step: 1, done: false };
    Object.keys(A).forEach((k) => delete A[k]);
    save();
    form.reset();
    $$(".countries .answer").forEach((l) => { l.hidden = false; });
    $("#countrySearch").value = "";
    countCountries();
    updateNotes();
    $("#quizForm").hidden = false;
    $("#qprogress").hidden = false;
    $("#qresult").hidden = true;
    $("#qSign").hidden = true;
    show(1);
  });

  // searchable country list
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function countCountries() {
    const shown = $$(".countries .answer").filter((l) => !l.hidden).length;
    $("#countryCount").textContent = shown === 0 ? "No country found." : shown + " countries";
  }
  $("#countrySearch").addEventListener("input", (e) => {
    const q = norm(e.target.value.trim());
    $$(".countries .answer").forEach((l) => { l.hidden = !norm($("span:last-child", l).textContent).includes(q); });
    countCountries();
  });
  // pressing Enter in the search box must not submit the form
  $("#countrySearch").addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });

  // ---------- start ----------
  restore();
  countCountries();
  if (data.done) { show(data.step || TOTAL, false); showResult(); }
  else show(Math.min(Math.max(data.step, 1), TOTAL), false);
})();
