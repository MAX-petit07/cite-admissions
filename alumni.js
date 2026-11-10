// =====================================================
// alumni.js — only used by alumni.html
//   1. Filters (topic + language)
//   2. The two form panels (<dialog>)
//   3. Form checks with friendly errors
// Nothing is sent or saved anywhere: this is a prototype.
// =====================================================
(function () {
  "use strict";

  // ---------- 1. FILTERS ----------
  const grid = document.getElementById("alumniGrid");
  if (!grid) return; // not the alumni page

  const cards = Array.from(grid.querySelectorAll(".alumni-card"));
  const chips = Array.from(document.querySelectorAll(".filter-chip"));
  const countEl = document.getElementById("alumniCount");
  const emptyEl = document.getElementById("alumniEmpty");
  const clearBtn = document.getElementById("clearFilters");

  // The chosen value for each group ("" = nothing chosen).
  // A card is shown only if it matches BOTH groups (topic AND language).
  const selected = { topic: "", lang: "" };

  function applyFilters() {
    let shown = 0;
    cards.forEach((card) => {
      const topics = card.dataset.topics.split("|");
      const langs = card.dataset.langs.split("|");
      const match =
        (!selected.topic || topics.includes(selected.topic)) &&
        (!selected.lang || langs.includes(selected.lang));
      card.hidden = !match;
      if (match) shown++;
    });
    countEl.textContent = `Showing ${shown} alumni`;
    emptyEl.hidden = shown !== 0;
    clearBtn.hidden = !selected.topic && !selected.lang;
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.group;
      // clicking the chosen chip again turns the filter off
      selected[group] = selected[group] === chip.dataset.value ? "" : chip.dataset.value;
      chips
        .filter((c) => c.dataset.group === group)
        .forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.value === selected[group])));
      applyFilters();
    });
  });

  clearBtn.addEventListener("click", () => {
    selected.topic = "";
    selected.lang = "";
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
    applyFilters();
  });

  // ---------- 2. PANELS ----------
  const askDialog = document.getElementById("askDialog");
  const volDialog = document.getElementById("volDialog");

  function resetPanel(dialog) {
    const form = dialog.querySelector("form");
    form.reset();
    form.hidden = false;
    dialog.querySelector(".done").hidden = true;
    dialog.querySelectorAll(".field").forEach(clearError);
    const counter = dialog.querySelector(".counter");
    if (counter) counter.textContent = "0 / 500";
  }

  function openPanel(dialog) {
    resetPanel(dialog);
    dialog.showModal(); // the browser handles Escape and keeps the focus inside
    const first = dialog.querySelector("input, select, textarea");
    if (first) first.focus();
  }

  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.open === "ask") {
        document.getElementById("askWho").textContent = btn.dataset.alumni || "an alumni";
        openPanel(askDialog);
      } else {
        openPanel(volDialog);
      }
    });
  });

  [askDialog, volDialog].forEach((dialog) => {
    // Close buttons (✕, Cancel, Close)
    dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dialog.close()));
    // Click on the dark area outside the panel
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });

  // The "community rules" link inside the panel: close the panel, then jump to the rules
  document.querySelectorAll("[data-to-rules]").forEach((a) =>
    a.addEventListener("click", () => a.closest("dialog").close())
  );

  // ---------- 3. FORM CHECKS ----------
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function clearError(field) {
    const err = field.querySelector(".field__error");
    if (!err) return;
    err.hidden = true;
    err.textContent = "";
    field.classList.remove("is-invalid");
    field.querySelectorAll("input, select, textarea").forEach((i) => i.removeAttribute("aria-invalid"));
  }

  // Returns true if the field is fine. Otherwise shows a friendly message.
  function checkField(field) {
    const rule = field.dataset.rule;
    if (!rule) return true; // optional field
    const control = field.querySelector("input, select, textarea");
    let message = "";

    if (rule === "text") {
      if (!control.value.trim()) message = field.dataset.errorEmpty;
    } else if (rule === "email") {
      const value = control.value.trim();
      if (!value) message = field.dataset.errorEmpty;
      else if (!EMAIL.test(value)) message = field.dataset.errorInvalid;
    } else if (rule === "checkbox") {
      if (!control.checked) message = field.dataset.errorEmpty;
    } else if (rule === "group") {
      if (!field.querySelector("input:checked")) message = field.dataset.errorEmpty;
    }

    const err = field.querySelector(".field__error");
    if (!message) {
      clearError(field);
      return true;
    }
    // give the error an id so screen readers can link it to the field
    if (!err.id) err.id = "err-" + Math.random().toString(36).slice(2, 8);
    err.textContent = message;
    err.hidden = false;
    field.classList.add("is-invalid");
    field.querySelectorAll("input, select, textarea").forEach((i) => {
      i.setAttribute("aria-invalid", "true");
      if (rule === "group") i.setAttribute("aria-describedby", err.id);
    });
    return false;
  }

  function setupForm(dialog) {
    const form = dialog.querySelector("form");
    const fields = Array.from(form.querySelectorAll(".field"));

    // Re-check a field as soon as the person fixes it
    fields.forEach((field) => {
      const fix = () => {
        if (field.classList.contains("is-invalid")) checkField(field);
      };
      field.addEventListener("input", fix);
      field.addEventListener("change", fix);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstBad = null;
      fields.forEach((field) => {
        if (!checkField(field) && !firstBad) firstBad = field;
      });
      if (firstBad) {
        firstBad.querySelector("input, select, textarea").focus();
        return;
      }
      // All good. Prototype: we show the thank-you message and send nothing.
      form.hidden = true;
      const done = dialog.querySelector(".done");
      done.hidden = false;
      done.focus();
    });
  }

  setupForm(askDialog);
  setupForm(volDialog);

  // Character counter for the question box (max 500)
  const question = document.getElementById("askQuestion");
  const counter = document.getElementById("askCount");
  question.addEventListener("input", () => {
    counter.textContent = `${question.value.length} / 500`;
  });
})();
