(() => {
  const SESSION_KEY = "lafamilia_owner_session";
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function previewComment(comment, maxLength = 170) {
    const clean = String(comment || "").replace(/\s+/g, " ").trim();
    if (!clean) return "Aucun commentaire renseigné.";
    return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}…` : clean;
  }

  async function supabaseFetch(path) {
    const session = getSession();
    if (!supabaseUrl || !supabaseAnonKey || !session?.accessToken) return null;

    const response = await fetch(`${supabaseUrl}${path}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return null;
    return response.json();
  }

  function getVisibleReportIds() {
    return Array.from(document.querySelectorAll("a.owner-report-card[href*='rapport.html?id=']"))
      .map((link) => new URL(link.href, window.location.href).searchParams.get("id"))
      .filter(Boolean);
  }

  async function addDashboardCommentPreviews() {
    const links = Array.from(document.querySelectorAll("a.owner-report-card[href*='rapport.html?id=']"));
    if (!links.length) return;

    const ids = [...new Set(getVisibleReportIds())];
    if (!ids.length) return;

    const reports = await supabaseFetch(
      `/rest/v1/staff_cleaning_reports?select=id,comment&id=in.(${ids.join(",")})`,
    );
    if (!Array.isArray(reports)) return;

    const commentsById = new Map(reports.map((report) => [String(report.id), report.comment || ""]));

    links.forEach((link) => {
      if (link.querySelector("[data-report-comment-preview]")) return;

      const id = new URL(link.href, window.location.href).searchParams.get("id");
      const comment = commentsById.get(String(id));
      const paragraph = document.createElement("p");
      paragraph.className = "owner-muted";
      paragraph.setAttribute("data-report-comment-preview", "true");
      paragraph.innerHTML = `<strong>Commentaire :</strong> ${escapeHtml(previewComment(comment))}`;

      const stats = link.querySelector(".owner-mini-stats");
      if (stats) {
        stats.insertAdjacentElement("beforebegin", paragraph);
      } else {
        link.appendChild(paragraph);
      }
    });
  }

  function alwaysShowReportCommentSection() {
    const section = document.querySelector("[data-report-comment-section]");
    const paragraph = document.querySelector("[data-report-comment]");
    if (!section || !paragraph) return;

    section.hidden = false;
    if (!paragraph.textContent.trim()) {
      paragraph.textContent = "Aucun commentaire renseigné.";
    }
  }

  function init() {
    if (document.body.matches("[data-page='owner-dashboard']")) {
      addDashboardCommentPreviews();
      const container = document.querySelector("[data-owner-properties]");
      if (container) {
        const observer = new MutationObserver(addDashboardCommentPreviews);
        observer.observe(container, { childList: true, subtree: true });
      }
    }

    if (document.body.matches("[data-page='owner-report']")) {
      alwaysShowReportCommentSection();
      const content = document.querySelector("[data-owner-content]");
      if (content) {
        const observer = new MutationObserver(alwaysShowReportCommentSection);
        observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
