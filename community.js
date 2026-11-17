// =====================================================
// community.js — only used by community.html
//   1. list of questions (search, category filter, "load more")
//   2. the "Ask a question" panel (<dialog>)
//   3. Team tools (members panel) — built ONLY for MANI Team members
//
// Buttons for Team members are only drawn when the database says the
// logged-in person's role is "team". Even if someone forced them to appear,
// the database refuses every Team action from anyone else.
// =====================================================
(function () {
  "use strict";

  var QA = window.QA;
  var Auth = window.CiteAuth;
  if (!QA || !Auth) return;

  function $(id) { return document.getElementById(id); }

  // ---------- 1. THE LIST ----------
  var state = { category: "", search: "", offset: 0, total: 0, includeHidden: false };
  var requestNumber = 0; // so a slow old answer can't overwrite a newer one

  var listEl = $("qList");
  var statusEl = $("qStatus");
  var errorEl = $("qError");
  var emptyEl = $("qEmpty");
  var moreBtn = $("qMore");
  var clearBtn = $("qClear");
  var searchEl = $("qSearch");

  function excerpt(text) {
    var flat = String(text || "").replace(/\s+/g, " ").trim();
    return flat.length > 170 ? flat.slice(0, 167) + "…" : flat;
  }

  function questionCard(q) {
    var parts = QA.splitStarter(q);
    var card = QA.el("article", "q-card" + (q.status === "hidden" ? " is-hidden" : ""));

    var tags = QA.el("div", "q-card__tags");
    tags.appendChild(QA.el("span", "tag-cat", QA.categoryLabel(q.category)));
    if (parts.starter) tags.appendChild(QA.el("span", "tag-starter", "MANI starter question"));
    if (q.status === "hidden") tags.appendChild(QA.el("span", "tag-hidden", "Hidden"));
    card.appendChild(tags);

    var h = QA.el("h3", "q-card__title");
    var link = QA.el("a", "", q.title);
    link.href = "question.html?id=" + encodeURIComponent(q.id);
    h.appendChild(link);
    card.appendChild(h);

    var text = excerpt(parts.text);
    if (text) card.appendChild(QA.el("p", "q-card__excerpt", text));

    var meta = QA.el("div", "q-meta");
    meta.appendChild(QA.el("span", "q-meta__name", QA.authorName(q.author)));
    meta.appendChild(QA.roleBadge(q.author));
    meta.appendChild(QA.el("span", "q-meta__date", QA.formatDate(q.created_at)));
    var n = q.answers && q.answers[0] && q.answers[0].count ? q.answers[0].count : 0;
    meta.appendChild(QA.el("span", "q-meta__answers", n === 1 ? "1 answer" : n + " answers"));
    card.appendChild(meta);
    return card;
  }

  function updateStatus() {
    var filtered = !!(state.category || state.search);
    clearBtn.hidden = !filtered;
    var shown = listEl.children.length;
    if (state.total === 0) {
      statusEl.textContent = "No questions found";
    } else {
      statusEl.textContent = "Showing " + shown + " of " + state.total + (state.total === 1 ? " question" : " questions");
    }
    moreBtn.hidden = shown >= state.total;
  }

  async function load(reset) {
    var mine = ++requestNumber;
    if (reset) {
      state.offset = 0;
      QA.clear(listEl);
      emptyEl.hidden = true;
    }
    errorEl.hidden = true;
    listEl.setAttribute("aria-busy", "true");
    moreBtn.disabled = true;
    if (reset) statusEl.textContent = "Loading questions…";

    var res = await QA.listQuestions({
      offset: state.offset, category: state.category, search: state.search, includeHidden: state.includeHidden,
    });
    if (mine !== requestNumber) return; // a newer search has started
    listEl.setAttribute("aria-busy", "false");
    moreBtn.disabled = false;

    if (res.error) {
      errorEl.textContent = QA.friendlyError(res.error);
      errorEl.hidden = false;
      statusEl.textContent = "";
      moreBtn.hidden = true;
      return;
    }
    state.total = res.count === null || res.count === undefined ? res.rows.length : res.count;
    res.rows.forEach(function (q) { listEl.appendChild(questionCard(q)); });
    state.offset = listEl.children.length;
    updateStatus();

    if (state.total === 0) {
      emptyEl.textContent = state.category || state.search
        ? "No questions match your search. Try other words or clear the filters."
        : "No questions yet. Be the first to ask one!";
      emptyEl.hidden = false;
    }
  }

  // ----- category chips -----
  var chipBox = $("qCategories");
  var chips = [];
  function addChip(value, label) {
    var b = QA.el("button", "chip filter-chip", label);
    b.type = "button";
    b.dataset.value = value;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      state.category = state.category === value ? "" : value;
      syncChips();
      syncUrl();
      load(true);
    });
    chipBox.appendChild(b);
    chips.push(b);
  }
  QA.CATEGORIES.forEach(function (c) { addChip(c[0], c[1]); });
  function syncChips() {
    chips.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === state.category)); });
  }

  // ----- search (waits a moment after typing) -----
  var timer = null;
  searchEl.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.search = searchEl.value.trim();
      syncUrl();
      load(true);
    }, 350);
  });

  clearBtn.addEventListener("click", function () {
    state.category = "";
    state.search = "";
    searchEl.value = "";
    syncChips();
    syncUrl();
    load(true);
  });
  moreBtn.addEventListener("click", function () { load(false); });

  // ----- keep the filters in the address so a search can be shared -----
  function syncUrl() {
    var p = new URLSearchParams();
    if (state.category) p.set("category", state.category);
    if (state.search) p.set("q", state.search);
    var qs = p.toString();
    try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) { /* fine */ }
  }
  (function readUrl() {
    var p = new URLSearchParams(location.search);
    var c = p.get("category") || "";
    if (QA.CATEGORIES.some(function (x) { return x[0] === c; })) state.category = c;
    state.search = (p.get("q") || "").slice(0, 60);
    searchEl.value = state.search;
    syncChips();
  })();

  // ---------- 2. ASK A QUESTION ----------
  var dialog = $("askDialog");
  var form = $("askForm2");
  var views = { out: $("askLoggedOut"), inn: $("askLoggedIn"), none: $("askNoProfile") };
  var asking = false;

  var catSelect = $("askQCategory");
  QA.CATEGORIES.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c[0];
    o.textContent = c[1];
    catSelect.appendChild(o);
  });

  function showAskView() {
    var v = QA.viewer();
    views.out.hidden = !(v.ready && !v.loggedIn);
    views.inn.hidden = !(v.loggedIn && v.profile);
    views.none.hidden = !(v.loggedIn && !v.profile);
  }

  function setFieldError(field, message) {
    var err = field.querySelector(".field__error");
    var input = field.querySelector("input, textarea, select");
    if (!message) {
      err.hidden = true; err.textContent = "";
      field.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      return true;
    }
    err.textContent = message; err.hidden = false;
    field.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    return false;
  }

  var checks = {
    title: function (v) {
      v = v.trim();
      if (!v) return "Please write a title for your question.";
      if (v.length < 10) return "The title needs at least 10 characters.";
      if (v.length > 150) return "The title can have 150 characters at most.";
      return "";
    },
    body: function (v) {
      v = v.trim();
      if (!v) return "Please describe your question.";
      if (v.length < 10) return "The description needs at least 10 characters.";
      if (v.length > 2000) return "The description can have 2000 characters at most.";
      return "";
    },
    category: function (v) {
      return QA.CATEGORIES.some(function (c) { return c[0] === v; }) ? "" : "Please choose a category.";
    },
  };

  form.querySelectorAll(".field[data-check]").forEach(function (field) {
    var fix = function () {
      if (field.classList.contains("is-invalid")) {
        setFieldError(field, checks[field.dataset.check](field.querySelector("input, textarea, select").value));
      }
    };
    field.addEventListener("input", fix);
    field.addEventListener("change", fix);
  });
  $("askQBody").addEventListener("input", function () {
    $("askQBody-count").textContent = $("askQBody").value.length + " / 2000";
  });

  function resetForm() {
    form.reset();
    form.querySelectorAll(".field").forEach(function (f) { setFieldError(f, ""); });
    $("askQBody-count").textContent = "0 / 2000";
    $("askMsg").hidden = true;
  }

  function openAsk() {
    resetForm();
    showAskView();
    dialog.showModal();
    var first = dialog.querySelector("#askLoggedIn:not([hidden]) input, #askLoggedOut:not([hidden]) a");
    if (first) first.focus();
  }

  $("askTop").addEventListener("click", openAsk);
  dialog.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { dialog.close(); }); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  dialog.querySelectorAll("[data-to-rules]").forEach(function (a) { a.addEventListener("click", function () { dialog.close(); }); });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (asking) return;
    var msg = $("askMsg");
    msg.hidden = true;

    var firstBad = null;
    form.querySelectorAll(".field[data-check]").forEach(function (field) {
      var input = field.querySelector("input, textarea, select");
      var ok = setFieldError(field, checks[field.dataset.check](input.value));
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) { firstBad.focus(); return; }

    asking = true;
    var btn = $("askSubmit");
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Publishing…";
    form.querySelector(".lockable").disabled = true;
    form.setAttribute("aria-busy", "true");

    var res = await QA.createQuestion({
      title: $("askQTitle").value.trim(),
      body: $("askQBody").value.trim(),
      category: catSelect.value,
    });

    if (res.error || !res.data || !res.data.id) {
      asking = false;
      btn.disabled = false;
      btn.textContent = label;
      form.querySelector(".lockable").disabled = false;
      form.removeAttribute("aria-busy");
      msg.textContent = QA.friendlyError(res.error);
      msg.className = "form-message";
      msg.hidden = false;
      return;
    }
    // Published: go to the new question's page
    window.location.href = "question.html?id=" + encodeURIComponent(res.data.id);
  });

  // ---------- 3. TEAM TOOLS (only built for MANI Team members) ----------
  var teamSection = $("teamTools");
  var teamToggleSlot = $("qTeamToggle");
  var teamBuilt = false;

  function buildTeamToggle() {
    QA.clear(teamToggleSlot);
    var label = QA.el("label", "check check--inline");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = "qIncludeHidden";
    box.checked = state.includeHidden;
    box.addEventListener("change", function () { state.includeHidden = box.checked; load(true); });
    label.appendChild(box);
    label.appendChild(QA.el("span", "", "Team: include hidden questions"));
    teamToggleSlot.appendChild(label);
  }

  var MEMBER_ACTIONS = function (m) {
    // [button label, new role, new verified]
    if (m.role === "student") return [["Make alumni (unverified)", "alumni", false], ["Make verified alumni", "alumni", true]];
    if (m.role === "alumni" && !m.verified) return [["Verify alumni", "alumni", true], ["Back to student", "student", false]];
    if (m.role === "alumni" && m.verified) return [["Remove verification", "alumni", false], ["Back to student", "student", false]];
    return []; // team members are managed in the database, not here
  };

  function buildTeamTools() {
    QA.clear(teamSection);
    var card = QA.el("div", "card team-tools");
    var details = document.createElement("details");
    var summary = QA.el("summary", "", "Team tools: members");
    details.appendChild(summary);

    var inner = QA.el("div", "team-tools__body");
    inner.appendChild(QA.el("p", "muted", "Only MANI Team members can see this. Changes are checked by the database, so they only work for authorised Team accounts."));

    var row = QA.el("div", "team-tools__search");
    var input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Search members by name…";
    input.setAttribute("aria-label", "Search members by name");
    input.maxLength = 60;
    row.appendChild(input);
    inner.appendChild(row);

    var message = QA.el("p", "form-message", "");
    message.hidden = true;
    message.setAttribute("role", "status");
    inner.appendChild(message);

    var results = QA.el("ul", "members");
    inner.appendChild(results);

    var timerM = null;
    var runNumber = 0;
    async function search() {
      var mine = ++runNumber;
      var res = await QA.listMembers(input.value);
      if (mine !== runNumber) return;
      QA.clear(results);
      if (res.error) { showMsg(QA.friendlyError(res.error), false); return; }
      if (!res.rows.length) { results.appendChild(QA.el("li", "muted", "No members found.")); return; }
      var me = Auth.state().user;
      res.rows.forEach(function (m) { results.appendChild(memberRow(m, me)); });
    }
    function showMsg(text, ok) {
      message.textContent = text;
      message.className = "form-message" + (ok ? " form-message--ok" : "");
      message.hidden = false;
    }
    function memberRow(m, me) {
      var li = QA.el("li", "member");
      var who = QA.el("div", "member__who");
      // Team sees the REAL stored name here (so impersonation attempts are visible)
      who.appendChild(QA.el("strong", "", m.display_name || "(no name)"));
      who.appendChild(QA.roleBadge(m));
      who.appendChild(QA.el("span", "member__meta", "joined " + QA.formatDate(m.created_at) + " · id " + String(m.id).slice(0, 8)));
      if (m.role !== "team" && Auth.isReservedName(m.display_name)) {
        who.appendChild(QA.el("span", "tag-hidden", "Name looks like impersonation"));
      }
      li.appendChild(who);

      var actions = QA.el("div", "member__actions");
      if (me && m.id === me.id) {
        actions.appendChild(QA.el("span", "muted", "This is you"));
      } else {
        MEMBER_ACTIONS(m).forEach(function (a) {
          var b = QA.el("button", "btn btn--light btn--small", a[0]);
          b.type = "button";
          b.addEventListener("click", async function () {
            b.disabled = true;
            var r = await QA.setRole(m.id, a[1], a[2]);
            if (r.error) {
              b.disabled = false;
              showMsg(QA.friendlyError(r.error), false);
              return;
            }
            showMsg("Updated " + (m.display_name || "member") + ".", true);
            search();
          });
          actions.appendChild(b);
        });
      }
      li.appendChild(actions);
      return li;
    }

    input.addEventListener("input", function () { clearTimeout(timerM); timerM = setTimeout(search, 350); });
    details.addEventListener("toggle", function () { if (details.open && !results.children.length) search(); });

    details.appendChild(inner);
    card.appendChild(details);
    teamSection.appendChild(card);
  }

  function applyViewer() {
    var v = QA.viewer();
    if (v.isTeam) {
      if (!teamBuilt) { buildTeamTools(); buildTeamToggle(); teamBuilt = true; }
      teamSection.hidden = false;
    } else {
      // not a team member: nothing exists in the page, and hidden items are not requested
      QA.clear(teamSection);
      QA.clear(teamToggleSlot);
      teamSection.hidden = true;
      teamBuilt = false;
      if (state.includeHidden) { state.includeHidden = false; load(true); }
    }
    if (dialog.open) showAskView();
  }

  // Wait for the login state, then show the list. Re-run when someone logs in or out.
  var first = true;
  Auth.onChange(function (s) {
    if (!Auth.available) {
      errorEl.textContent = "We couldn't load the community service. Check your internet connection and reload the page.";
      errorEl.hidden = false;
      statusEl.textContent = "";
      return;
    }
    if (!s.ready) return;
    applyViewer();
    if (first) { first = false; load(true); }
  });
})();
