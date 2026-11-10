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
