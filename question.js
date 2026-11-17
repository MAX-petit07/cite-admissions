// =====================================================
// question.js — only used by question.html  (question.html?id=...)
//   - shows one question with ALL its published answers
//   - lets logged-in people answer (the source choices depend on their
//     role as stored in the database)
//   - Team members get Hide / Restore buttons
//
// Everything people wrote is shown as plain text. Source links only
// become links when they start with https://.
// =====================================================
(function () {
  "use strict";

  var QA = window.QA;
  var Auth = window.CiteAuth;
  if (!QA || !Auth) return;

  function $(id) { return document.getElementById(id); }

  var questionId = new URLSearchParams(location.search).get("id") || "";
  var current = null;      // the question as loaded from the database
  var posting = false;
  var banner = "";         // one-time message after posting an answer

  var views = {
    loading: $("qpLoading"), notFound: $("qpNotFound"), error: $("qpError"), content: $("qpContent"),
  };
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
  }

  // ---------- Team buttons (only drawn for Team members) ----------
  function modButton(label, onClick) {
    var b = QA.el("button", "btn btn--light btn--small", label);
    b.type = "button";
    b.addEventListener("click", async function () {
      b.disabled = true;
      var err = await onClick();
      if (err) {
        b.disabled = false;
        flash(QA.friendlyError(err), false);
        return;
      }
      await load();
    });
    return b;
  }

  var flashEl = null;
  function flash(text, ok) {
    if (!flashEl) return;
    flashEl.textContent = text;
    flashEl.className = "form-message" + (ok ? " form-message--ok" : "");
    flashEl.hidden = false;
  }

  // ---------- The question ----------
  function renderQuestion(q, v) {
    var box = $("qpQuestion");
    QA.clear(box);
    var parts = QA.splitStarter(q);

    var tags = QA.el("div", "q-card__tags");
    tags.appendChild(QA.el("span", "tag-cat", QA.categoryLabel(q.category)));
    if (parts.starter) tags.appendChild(QA.el("span", "tag-starter", "MANI starter question"));
    if (q.status === "hidden") tags.appendChild(QA.el("span", "tag-hidden", "Hidden"));
    box.appendChild(tags);

    box.appendChild(QA.el("h2", "q-full__title", q.title));

    var meta = QA.el("div", "q-meta");
    meta.appendChild(QA.el("span", "q-meta__name", QA.authorName(q.author)));
    meta.appendChild(QA.roleBadge(q.author));
    meta.appendChild(QA.el("span", "q-meta__date", QA.formatDate(q.created_at)));
    box.appendChild(meta);

    if (q.status === "hidden") {
      box.appendChild(QA.el("p", "form-message", "This question is hidden. Only its author and the MANI team can see it."));
    }
    if (parts.starter) {
      box.appendChild(QA.el("p", "starter-note", "MANI starter question: posted by the MANI team to start the conversation. It was not asked by a real applicant yet."));
    }

    box.appendChild(QA.el("p", "q-body", parts.text));

    var foot = QA.el("div", "q-foot");
    foot.appendChild(QA.reportLink("question", q.id, q.id));
    if (v.isTeam) {
      var bar = QA.el("div", "mod-bar");
      bar.appendChild(QA.el("span", "mod-bar__label", "Team:"));
      if (q.status === "hidden") {
        bar.appendChild(modButton("Restore question", function () { return QA.setQuestionStatus(q.id, "published").then(function (r) { return r.error; }); }));
      } else {
        bar.appendChild(modButton("Hide question", function () { return QA.setQuestionStatus(q.id, "hidden").then(function (r) { return r.error; }); }));
      }
      foot.appendChild(bar);
    }
    box.appendChild(foot);
  }

  // ---------- The answers ----------
  function renderAnswers(q, v) {
    var list = $("qpAnswers");
    QA.clear(list);
    var answers = (q.answers || []).slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    $("qpNoAnswers").hidden = answers.length > 0;
    $("answers-title").textContent = answers.length === 1 ? "1 answer" : answers.length + " answers";

    answers.forEach(function (a) {
      var info = QA.sourceInfo(a, a.author);
      var card = QA.el("article", "answer answer--" + info.key + (a.status === "hidden" ? " is-hidden" : ""));
      card.id = "answer-" + a.id;

      var top = QA.el("div", "answer__top");
      top.appendChild(QA.sourceChip(info));
      if (a.status === "hidden") top.appendChild(QA.el("span", "tag-hidden", "Hidden"));
      card.appendChild(top);

      var meta = QA.el("div", "q-meta");
      meta.appendChild(QA.el("span", "q-meta__name", QA.authorName(a.author)));
      meta.appendChild(QA.roleBadge(a.author));
      meta.appendChild(QA.el("span", "q-meta__date", QA.formatDate(a.created_at)));
      card.appendChild(meta);

      card.appendChild(QA.el("p", "q-body", a.body));
      card.appendChild(QA.el("p", "answer__note", info.note));
      var link = QA.sourceLink(a.source_url, a.source_type === "team_verified");
      if (link) card.appendChild(link);

      var foot = QA.el("div", "q-foot");
      foot.appendChild(QA.reportLink("answer", a.id, q.id));
      if (v.isTeam) {
        var bar = QA.el("div", "mod-bar");
        bar.appendChild(QA.el("span", "mod-bar__label", "Team:"));
        if (a.status === "hidden") {
          bar.appendChild(modButton("Restore answer", function () { return QA.setAnswerStatus(a.id, "published").then(function (r) { return r.error; }); }));
        } else {
          bar.appendChild(modButton("Hide answer", function () { return QA.setAnswerStatus(a.id, "hidden").then(function (r) { return r.error; }); }));
        }
        foot.appendChild(bar);
      }
      card.appendChild(foot);
      list.appendChild(card);
    });
  }

  // ---------- The answer form ----------
  // Which answer types a person may CHOOSE. The database enforces the same rules.
  function sourceChoices(v) {
    var out = [["community", "Community answer"]];
    if (v.isTeam) out.push(["team_verified", "Checked by the MANI team"]);
    else if (v.isAlumni) out.push(["alumni_experience", "Alumni experience"]);
    return out;
  }

  var RULES_MINI = function () {
    var box = QA.el("div", "rules-mini");
    box.setAttribute("role", "note");
    box.appendChild(QA.el("strong", "", "Before you post"));
    var ul = document.createElement("ul");
    ["Never send money to anyone.",
     "Never share your passport, ID or application documents.",
     "No room sales, sublets or “guaranteed places”. Admission only happens through CIUP."
    ].forEach(function (t) { ul.appendChild(QA.el("li", "", t)); });
    box.appendChild(ul);
    var a = QA.el("a", "", "Read all the community rules");
    a.href = "community.html#rules";
    box.appendChild(a);
    return box;
  };

  function fieldBlock(labelText, control, id, hintText) {
    var f = QA.el("div", "field");
    var label = QA.el("label", "", labelText);
    label.htmlFor = id;
    f.appendChild(label);
    f.appendChild(control);
    var hint = null;
    if (hintText !== undefined) { hint = QA.el("p", "field__hint", hintText); hint.id = id + "-hint"; f.appendChild(hint); control.setAttribute("aria-describedby", id + "-hint " + id + "-err"); }
    else control.setAttribute("aria-describedby", id + "-err");
    var err = QA.el("p", "field__error"); err.id = id + "-err"; err.hidden = true;
    f.appendChild(err);
    return { wrap: f, error: err, hint: hint, control: control };
  }

  function setErr(block, message) {
    if (!message) {
      block.error.hidden = true; block.error.textContent = "";
      block.wrap.classList.remove("is-invalid"); block.control.removeAttribute("aria-invalid");
      return true;
    }
    block.error.textContent = message; block.error.hidden = false;
    block.wrap.classList.add("is-invalid"); block.control.setAttribute("aria-invalid", "true");
    return false;
  }

  function renderAnswerBox(q, v) {
    var box = $("qpAnswerBox");
    QA.clear(box);

    var heading = QA.el("h2", "", "Your answer");
    heading.id = "answer-form-title";
    box.appendChild(heading);

    if (banner) {
      var ok = QA.el("p", "form-message form-message--ok", banner);
      ok.setAttribute("role", "status");
      box.appendChild(ok);
      banner = "";
    }

    if (q.status === "hidden") {
      box.appendChild(QA.el("p", "muted", "This question is hidden, so it can't receive new answers."));
      return;
    }
    if (!v.ready) return;
    if (!v.loggedIn) {
      box.appendChild(QA.el("p", "", "You need an account to answer. It only takes a minute."));
      var actions = QA.el("div", "panel__actions");
      var reg = QA.el("a", "btn btn--dark", "Create an account"); reg.href = "account.html#register";
      var sign = QA.el("a", "btn btn--light", "Sign in"); sign.href = "account.html#signin";
      actions.appendChild(reg); actions.appendChild(sign);
      box.appendChild(actions);
      return;
    }
    if (!v.profile) {
      box.appendChild(QA.el("p", "form-message", "We couldn't load your account details. Please reload the page and try again."));
      return;
    }

    box.appendChild(QA.el("p", "panel__note", "Your answer is published immediately. The MANI team can hide posts that break the rules."));

    var form = document.createElement("form");
    form.noValidate = true;
    var lock = QA.el("fieldset", "lockable");

    // answer text
    var ta = document.createElement("textarea");
    ta.id = "ansBody"; ta.rows = 6; ta.maxLength = 3000;
    var body = fieldBlock("Your answer", ta, "ansBody");
    var counter = QA.el("p", "counter", "0 / 3000"); counter.id = "ansBody-count";
    body.wrap.insertBefore(counter, body.error);
    ta.addEventListener("input", function () { counter.textContent = ta.value.length + " / 3000"; if (body.wrap.classList.contains("is-invalid")) checkBody(); });
    lock.appendChild(body.wrap);

    // source type (only when there is a choice)
    var choices = sourceChoices(v);
    var select = document.createElement("select");
    select.id = "ansSource";
    choices.forEach(function (c) {
      var o = document.createElement("option"); o.value = c[0]; o.textContent = c[1]; select.appendChild(o);
    });
    var sourceBlock = fieldBlock("What kind of answer is this?", select, "ansSource");
    var sourceNote = QA.el("p", "field__hint", "");
    sourceBlock.wrap.insertBefore(sourceNote, sourceBlock.error);
    if (choices.length > 1) lock.appendChild(sourceBlock.wrap);

    // source link
    var urlInput = document.createElement("input");
    urlInput.type = "text"; urlInput.id = "ansUrl"; urlInput.maxLength = 500; urlInput.placeholder = "https://";
    urlInput.setAttribute("autocomplete", "off");
    var urlBlock = fieldBlock("Source link (optional)", urlInput, "ansUrl", "A web page that supports your answer. It must start with https://");
    lock.appendChild(urlBlock.wrap);

    function updateSourceUi() {
      var type = select.value;
      var label = urlBlock.wrap.querySelector("label");
      if (type === "team_verified") {
        label.textContent = "Source link (required)";
        urlBlock.hint.textContent = "The page you checked this answer against. It must start with https://. We show the website name next to the link.";
        sourceNote.textContent = "Only choose this if you have checked the answer against the source you cite. It will be labelled “Checked by the MANI team”. That does not mean CIUP has approved it, and it is not an official CIUP answer.";
      } else if (type === "alumni_experience") {
        label.textContent = "Source link (optional)";
        urlBlock.hint.textContent = "A web page that supports your answer. It must start with https://";
        sourceNote.textContent = v.profile.verified
          ? "Shown as “Alumni experience”: your own experience, not official information."
          : "Shown as “Alumni experience (unverified)” until a MANI team member verifies your alumni status.";
      } else {
        label.textContent = "Source link (optional)";
        urlBlock.hint.textContent = "A web page that supports your answer. It must start with https://";
        sourceNote.textContent = choices.length > 1 ? "Shown as “Community answer”: not checked by MANI and not official." : "";
      }
      if (type !== "team_verified") setErr(urlBlock, "");
    }
    select.addEventListener("change", updateSourceUi);
    if (choices.length === 1) {
      var fixed = QA.el("p", "field__hint", "Your answer will be shown as “Community answer”: not checked by MANI and not official.");
      lock.insertBefore(fixed, urlBlock.wrap);
    }
    updateSourceUi();

    form.appendChild(lock);
    form.appendChild(RULES_MINI());

    var msg = QA.el("p", "form-message", ""); msg.hidden = true; msg.setAttribute("role", "alert");
    form.appendChild(msg);
    var actions2 = QA.el("div", "panel__actions");
    var submit = QA.el("button", "btn btn--dark", "Publish answer");
    submit.type = "submit";
    actions2.appendChild(submit);
    form.appendChild(actions2);

    function checkBody() {
      var t = ta.value.trim();
      if (!t) return setErr(body, "Please write your answer.");
      if (t.length < 5) return setErr(body, "Your answer needs at least 5 characters.");
      if (t.length > 3000) return setErr(body, "Your answer can have 3000 characters at most.");
      return setErr(body, "");
    }
    function checkUrl() {
      var value = urlInput.value.trim();
      if (select.value === "team_verified" && !value) return setErr(urlBlock, "A Team-checked answer needs a source link.");
      if (value && !QA.isHttpsUrl(value)) return setErr(urlBlock, "The link must start with https:// and contain no spaces.");
      return setErr(urlBlock, "");
    }
    urlInput.addEventListener("input", function () { if (urlBlock.wrap.classList.contains("is-invalid")) checkUrl(); });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (posting) return;
      msg.hidden = true;
      var okBody = checkBody();
      var okUrl = checkUrl();
      if (!okBody) { ta.focus(); return; }
      if (!okUrl) { urlInput.focus(); return; }

      // The type is limited to what this person's role allows (the database checks again)
      var type = choices.some(function (c) { return c[0] === select.value; }) ? select.value : "community";

      posting = true;
      submit.disabled = true;
      var label = submit.textContent;
      submit.textContent = "Publishing…";
      lock.disabled = true;
      form.setAttribute("aria-busy", "true");

      var res = await QA.createAnswer({
        questionId: q.id, body: ta.value.trim(), sourceType: type, sourceUrl: urlInput.value.trim(),
      });
      posting = false;
      if (res.error) {
        submit.disabled = false;
        submit.textContent = label;
        lock.disabled = false;
        form.removeAttribute("aria-busy");
        msg.textContent = QA.friendlyError(res.error);
        msg.className = "form-message";
        msg.hidden = false;
        return;
      }
      banner = "Your answer has been published.";
      await load();
    });

    box.appendChild(form);
  }

  // ---------- Put it all together ----------
  function render() {
    if (!current) return;
    var v = QA.viewer();
    document.title = current.title + " — MANI";
    renderQuestion(current, v);
    renderAnswers(current, v);
    renderAnswerBox(current, v);
    // a place for messages from the Team buttons
    var box = $("qpQuestion");
    flashEl = QA.el("p", "form-message", "");
    flashEl.hidden = true;
    flashEl.setAttribute("role", "alert");
    box.appendChild(flashEl);
    show("content");
  }

  async function load() {
    if (!QA.UUID.test(questionId)) { show("notFound"); return; }
    var res = await QA.getQuestion(questionId);
    if (res.error) {
      views.error.textContent = QA.friendlyError(res.error);
      show("error");
      return;
    }
    if (!res.data) { show("notFound"); return; }
    current = res.data;
    render();
  }

  var started = false;
  Auth.onChange(function (s) {
    if (!Auth.available) {
      views.error.textContent = "We couldn't load the community service. Check your internet connection and reload the page.";
      show("error");
      return;
    }
    if (!s.ready) return;
    if (!started) { started = true; load(); return; }
    render(); // the login state changed: redraw the buttons and the form
  });
})();
