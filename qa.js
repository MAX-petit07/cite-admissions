// =====================================================
// qa.js — shared by community.html and question.html
//   - labels (contributor roles, answer sources, categories)
//   - the database calls (always through the Supabase client from auth.js)
//   - small helpers to build the page safely
//
// SAFETY RULES used everywhere in this file:
//   * Everything people wrote is put on the page with textContent (plain text),
//     never innerHTML, so it can never run as code.
//   * Roles come from public.profiles. The browser's idea of a role is only
//     used to decide which buttons to SHOW. The database decides what is ALLOWED.
// =====================================================
(function () {
  "use strict";

  var Auth = window.CiteAuth;
  if (!Auth) return;

  // PLACEHOLDER: replace with the team's real address before the public test.
  var REPORT_EMAIL = "team@example.com";

  var PAGE_SIZE = 20;
  var STARTER_MARKER = "MANI starter question";

  // [value stored in the database, label shown to people]
  var CATEGORIES = [
    ["applying", "Applying"],
    ["eligibility", "Eligibility"],
    ["documents", "Documents"],
    ["houses", "Choosing a house"],
    ["timeline", "Timeline & answers"],
    ["life_at_the_cite", "Life at the Cité"],
    ["arriving_in_paris", "Arriving in Paris"],
    ["other", "Other"],
  ];

  // ---------- Small helpers ----------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text; // plain text only
    return node;
  }
  function clear(node) { node.textContent = ""; }

  function categoryLabel(value) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i][0] === value) return CATEGORIES[i][1];
    return "Other";
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) { return ""; }
  }

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Same format as the database rule: https:// and no spaces.
  function isHttpsUrl(value) {
    if (!/^https:\/\/[^\s]{3,500}$/i.test(value)) return false;
    try { return new URL(value).protocol === "https:"; } catch (e) { return false; }
  }
  function siteName(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  // Who is looking at the page right now (used only to decide what to show)
  function viewer() {
    var s = Auth.state();
    var profile = s.user ? s.profile : null;
    return {
      ready: s.ready,
      loggedIn: !!s.user,
      profile: profile,
      profileFailed: !!(s.user && !profile),
      isTeam: !!(profile && profile.role === "team"),
      isAlumni: !!(profile && profile.role === "alumni"),
    };
  }

  // ---------- Names and badges ----------
  // A name that could be mistaken for the MANI team / CIUP is hidden for non-team people.
  function authorName(profile) {
    if (!profile) return "Former member";
    var name = profile.display_name || "Member";
    if (profile.role !== "team" && Auth.isReservedName(name)) return "Member";
    return name;
  }

  function roleBadge(profile) {
    if (!profile) return el("span", "badge badge--student", "Member");
    var info = Auth.roleInfo(profile);
    return el("span", "badge badge--" + info.key, info.label);
  }

  // ---------- Answer source labels ----------
  // community / alumni experience / "checked by the MANI team" must look different
  // and must never look like an official CIUP answer.
  function sourceInfo(answer, author) {
    if (answer.source_type === "team_verified") {
      return {
        key: "team",
        label: "Checked by the MANI team",
        note: "MANI checked this answer against the source below. This is not an official CIUP answer.",
      };
    }
    if (answer.source_type === "alumni_experience") {
      var trusted = author && (author.role === "team" || (author.role === "alumni" && author.verified));
      return {
        key: "alumni",
        label: trusted ? "Alumni experience" : "Alumni experience (unverified)",
        note: trusted
          ? "Personal experience of a verified alumni. Not official information."
          : "Personal experience. This person's alumni status has not been verified by MANI.",
      };
    }
    return {
      key: "community",
      label: "Community answer",
      note: "Shared by a community member. Not checked by MANI and not official.",
    };
  }

  function sourceChip(info) {
    return el("span", "source source--" + info.key, info.label);
  }

  // A link to a source, always showing the website name. Only https links become links.
  function sourceLink(url, checkedByTeam) {
    var wrap = el("p", "source-link");
    if (!url) return null;
    var site = siteName(url);
    if (!isHttpsUrl(url) || !site) {
      wrap.textContent = "Source: " + url;
      return wrap;
    }
    wrap.appendChild(el("span", "source-link__lead", checkedByTeam ? "Source checked by MANI: " : "Source link (not checked by MANI): "));
    var a = el("a", "", site + " ↗");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow ugc";
    wrap.appendChild(a);
    return wrap;
  }

  // ---------- Starter questions ----------
  // MANI starter questions are posted by the Team account and begin with a marker line.
  // The tag only appears when the author really is a team member (a student can't fake it).
  function splitStarter(question) {
    var body = String(question.body || "");
    var isStarter = !!(question.author && question.author.role === "team" && body.indexOf(STARTER_MARKER) === 0);
    if (!isStarter) return { starter: false, text: body };
    var rest = body.replace(/^[^\n]*\n?/, "").replace(/^\s+/, "");
    return { starter: true, text: rest };
  }

  // ---------- Report link (mailto to the team) ----------
  function reportHref(kind, id, questionId) {
    var origin = location.origin && location.origin !== "null" ? location.origin : "";
    var folder = location.pathname.replace(/[^/]*$/, "");
    var page = origin + folder + "question.html?id=" + encodeURIComponent(kind === "question" ? id : questionId);
    var subject = "Report a " + kind + " on MANI";
    var body = "I'd like to report this " + kind + " (id: " + id + ").\n\nPage: " + page + "\n\nWhy: ";
    return "mailto:" + REPORT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function reportLink(kind, id, questionId) {
    var a = el("a", "report-link", "Report");
    a.href = reportHref(kind, id, questionId);
    a.setAttribute("aria-label", "Report this " + kind);
    return a;
  }

  // ---------- Friendly error messages ----------
  function friendlyError(error) {
    var code = String((error && error.code) || "");
    var text = String((error && error.message) || "");
    var lower = text.toLowerCase();
    if (/failed to fetch|networkerror|load failed|network request failed/.test(lower)) {
      return "We couldn't reach the server. Check your internet connection and try again.";
    }
    if (/posting too fast/.test(lower)) return "You are posting too fast. Please wait a little and try again.";
    if (code === "PGRST301" || code === "PGRST303" || /jwt/.test(lower)) return "Your session has expired. Please sign in again.";
    if (code === "42501" || /row-level security|permission denied|only team members/.test(lower)) {
      return "You don't have permission to do that.";
    }
    if (code === "23514") return "Some text is too short, too long or in the wrong format. Please check the form.";
    if (code === "23503") return "That question no longer exists.";
    return "Something went wrong. Please try again in a moment.";
  }

  // ---------- Database calls ----------
  function sanitizeSearch(text) {
    // remove characters that have a special meaning in the search filter
    return String(text || "").replace(/[%_\\,()"*:;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  }

  var AUTHOR = "author:profiles(display_name,role,verified)";

  async function listQuestions(opts) {
    try {
      var q = Auth.client
        .from("questions")
        .select("id,title,body,category,status,created_at," + AUTHOR + ",answers(count)", { count: "exact" })
        .eq("answers.status", "published") // the answer count only counts published answers
        .order("created_at", { ascending: false })
        .range(opts.offset || 0, (opts.offset || 0) + PAGE_SIZE - 1);
      if (!opts.includeHidden) q = q.eq("status", "published");
      if (opts.category) q = q.eq("category", opts.category);
      var s = sanitizeSearch(opts.search);
      if (s) q = q.or("title.ilike.%" + s + "%,body.ilike.%" + s + "%");
      var r = await q;
      return { rows: r.data || [], count: r.count, error: r.error };
    } catch (e) {
      return { rows: [], count: 0, error: e };
    }
  }

  async function getQuestion(id) {
    try {
      var r = await Auth.client
        .from("questions")
        .select("id,title,body,category,status,created_at," + AUTHOR +
          ",answers(id,body,source_type,source_url,status,created_at," + AUTHOR + ")")
        .eq("id", id)
        .order("created_at", { referencedTable: "answers", ascending: true })
        .maybeSingle();
      return { data: r.data, error: r.error };
    } catch (e) {
      return { data: null, error: e };
    }
  }

  async function createQuestion(v) {
    try {
      var r = await Auth.client.from("questions")
        .insert({ title: v.title, body: v.body, category: v.category })
        .select("id").single();
      return { data: r.data, error: r.error };
    } catch (e) { return { data: null, error: e }; }
  }

  async function createAnswer(v) {
    try {
      var row = { question_id: v.questionId, body: v.body, source_type: v.sourceType };
      if (v.sourceUrl) row.source_url = v.sourceUrl;
      var r = await Auth.client.from("answers").insert(row).select("id").single();
      return { data: r.data, error: r.error };
    } catch (e) { return { data: null, error: e }; }
  }

  // ----- Team-only calls. The DATABASE refuses them for anyone who isn't on the team. -----
  async function rpc(name, args) {
    try {
      var r = await Auth.client.rpc(name, args);
      return { error: r.error };
    } catch (e) { return { error: e }; }
  }
  function setQuestionStatus(id, status) { return rpc("team_set_question_status", { q: id, new_status: status }); }
  function setAnswerStatus(id, status) { return rpc("team_set_answer_status", { a: id, new_status: status }); }
  function setRole(target, role, verified) { return rpc("team_set_role", { target: target, new_role: role, new_verified: verified }); }

  async function listMembers(search) {
    try {
      var q = Auth.client.from("profiles")
        .select("id,display_name,role,verified,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      var s = sanitizeSearch(search);
      if (s) q = q.ilike("display_name", "%" + s + "%");
      var r = await q;
      return { rows: r.data || [], error: r.error };
    } catch (e) { return { rows: [], error: e }; }
  }

  window.QA = {
    PAGE_SIZE: PAGE_SIZE,
    CATEGORIES: CATEGORIES,
    el: el,
    clear: clear,
    categoryLabel: categoryLabel,
    formatDate: formatDate,
    UUID: UUID,
    isHttpsUrl: isHttpsUrl,
    siteName: siteName,
    viewer: viewer,
    authorName: authorName,
    roleBadge: roleBadge,
    sourceInfo: sourceInfo,
    sourceChip: sourceChip,
    sourceLink: sourceLink,
    splitStarter: splitStarter,
    reportLink: reportLink,
    friendlyError: friendlyError,
    listQuestions: listQuestions,
    getQuestion: getQuestion,
    createQuestion: createQuestion,
    createAnswer: createAnswer,
    setQuestionStatus: setQuestionStatus,
    setAnswerStatus: setAnswerStatus,
    setRole: setRole,
    listMembers: listMembers,
  };
})();
