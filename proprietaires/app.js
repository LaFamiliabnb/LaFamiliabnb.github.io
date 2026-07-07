(() => {
  const SESSION_KEY = "lafamilia_owner_session";
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";

  function isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("ton-projet") && !supabaseAnonKey.includes("ta_anon_key"));
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function setText(selector, value, root = document) {
    const element = qs(selector, root);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function encodeStoragePath(path) {
    return String(path || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function storagePublicUrl(bucket, path) {
    if (!bucket || !path || !supabaseUrl) return "";
    return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`;
  }

  function getFileUrl(file, defaultBucket = "cleaning-reports") {
    if (!file) return "";

    if (typeof file === "string") {
      if (/^https?:\/\//i.test(file)) return file;
      return storagePublicUrl(defaultBucket, file);
    }

    if (typeof file !== "object") return "";

    const directUrl = file.url || file.src || file.publicUrl || file.public_url;
    if (directUrl && /^https?:\/\//i.test(directUrl)) return directUrl;

    const bucket = file.bucket || file.bucket_id || file.bucketId || defaultBucket;
    const path = file.path || file.name || file.fullPath || file.full_path;
    return storagePublicUrl(bucket, path);
  }

  function formatDate(date) {
    if (!date) return "Date non renseignée";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  }

  function formatDateTime(date) {
    if (!date) return "Date non renseignée";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function normalizeChecklist(checklist) {
    if (Array.isArray(checklist)) return checklist;
    if (!checklist || typeof checklist !== "object") return [];
    return Object.entries(checklist).map(([label, checked]) => ({ label, checked: Boolean(checked) }));
  }

  function reportChecklistScore(report) {
    const checklist = normalizeChecklist(report.checklist);
    const checked = checklist.filter((item) => Boolean(item.checked)).length;
    return `${checked}/${checklist.length}`;
  }

  function firstNameOnly(value) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    if (!clean || clean.toLowerCase() === "non renseigné") return clean || "Non renseigné";
    return clean.split(" ")[0];
  }

  function getReportDate(report) {
    return report.submitted_at || report.report_generated_at || report.created_at;
  }

  function getReportCleaner(report) {
    return firstNameOnly(report.staff_name || "Non renseigné");
  }

  function getReportGuest(report) {
    return report.booking_guest_name || "Non renseigné";
  }

  function getReportComment(report) {
    return String(report.comment || "").replace(/\s+/g, " ").trim();
  }

  function getReportCommentPreview(report, maxLength = 170) {
    const comment = getReportComment(report);
    if (!comment) return "Aucun commentaire renseigné.";
    return comment.length > maxLength ? `${comment.slice(0, maxLength).trim()}…` : comment;
  }

  function getPropertyCover(property) {
    const payload = property.payload || {};
    const candidates = [
      property.cover_url,
      payload.cover,
      payload.cover_url,
      payload.coverUrl,
      payload.picture,
      payload.image,
      payload.photo,
      Array.isArray(payload.photos) ? payload.photos[0] : null,
      Array.isArray(payload.images) ? payload.images[0] : null,
    ];

    for (const candidate of candidates) {
      const url = getFileUrl(candidate, "property-covers");
      if (url) return url;
    }
    return null;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function supabaseFetch(path, options = {}) {
    if (!isConfigured()) {
      throw new Error("Supabase n’est pas configuré. Crée proprietaires/config.js à partir de config.example.js.");
    }

    const response = await fetch(`${supabaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${options.accessToken || supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const payload = contentType.includes("application/json") && raw ? JSON.parse(raw) : raw;

    if (!response.ok) {
      const message = payload && typeof payload === "object" && payload.message ? payload.message : "Erreur Supabase";
      throw new Error(message);
    }

    return payload;
  }

  async function signIn(email, password) {
    const payload = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });

    const session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      user: {
        id: payload.user.id,
        email: payload.user.email,
      },
    };

    saveSession(session);
    return session;
  }

  async function signOut() {
    const session = getSession();
    if (session && session.accessToken) {
      try {
        await supabaseFetch("/auth/v1/logout", {
          method: "POST",
          accessToken: session.accessToken,
        });
      } catch (_error) {
        // La déconnexion locale reste prioritaire.
      }
    }

    clearSession();
    window.location.href = "./login.html";
  }

  async function getDashboardData(session) {
    const accounts = await supabaseFetch(
      `/rest/v1/owner_accounts?select=id,auth_user_id,name,email,nowistay_owner_id,created_at&auth_user_id=eq.${session.user.id}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!accounts.length) {
      throw new Error("Aucun compte propriétaire n’est relié à cet utilisateur Supabase. Crée une ligne dans owner_accounts avec son auth_user_id.");
    }

    const owner = accounts[0];
    const properties = await supabaseFetch(
      `/rest/v1/nowistay_properties?select=id,name,owner_id,capacity,property_type,city,country,payload&owner_id=eq.${owner.nowistay_owner_id}&order=name.asc`,
      { accessToken: session.accessToken },
    );

    const propertyIds = properties.map((property) => property.id);
    const reports = propertyIds.length
      ? await supabaseFetch(
          `/rest/v1/staff_cleaning_reports?select=id,mission_id,booking_id,property_id,team_member_id,staff_name,status,checklist,comment,problem_reported,problem_type,photos,submitted_at,created_at,report_document_path,report_generated_at&property_id=in.(${propertyIds.join(",")})&order=submitted_at.desc&limit=100`,
          { accessToken: session.accessToken },
        )
      : [];

    return { owner, properties, reports };
  }

  async function getReportDetail(session, reportId) {
    const reports = await supabaseFetch(
      `/rest/v1/staff_cleaning_reports?select=id,mission_id,booking_id,property_id,team_member_id,staff_name,status,checklist,comment,problem_reported,problem_type,photos,submitted_at,created_at,report_document_path,report_generated_at&id=eq.${reportId}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!reports.length) {
      throw new Error("Rapport introuvable ou non autorisé.");
    }

    const report = reports[0];
    const properties = await supabaseFetch(
      `/rest/v1/nowistay_properties?select=id,name,owner_id,capacity,property_type,city,country,payload&id=eq.${report.property_id}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!properties.length) {
      throw new Error("Logement introuvable ou non autorisé.");
    }

    return { report, property: properties[0] };
  }

  function requireSession() {
    const session = getSession();
    if (!session) {
      window.location.href = "./login.html";
      return null;
    }
    return session;
  }

  function showAlert(message, type = "error") {
    const alert = qs("[data-owner-alert]");
    if (!alert) return;
    alert.textContent = message;
    alert.className = `owner-alert ${type}`;
    alert.hidden = false;
  }

  function initLoginPage() {
    const form = qs("[data-owner-login-form]");
    const button = qs("[data-owner-login-button]");

    if (!isConfigured()) {
      showAlert("Supabase n’est pas encore configuré. Copie proprietaires/config.example.js vers proprietaires/config.js et renseigne l’URL + anon key.", "error");
      if (button) button.disabled = true;
      return;
    }

    if (getSession()) {
      window.location.href = "./dashboard.html";
      return;
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = qs("#owner-email")?.value.trim();
      const password = qs("#owner-password")?.value;

      if (!email || !password) {
        showAlert("Renseigne l’email et le mot de passe.");
        return;
      }

      button.disabled = true;
      button.textContent = "Connexion…";

      try {
        await signIn(email, password);
        window.location.href = "./dashboard.html";
      } catch (error) {
        showAlert(error.message || "Connexion impossible.");
      } finally {
        button.disabled = false;
        button.textContent = "Entrer dans mon espace";
      }
    });
  }

  function renderDashboard(data) {
    setText("[data-owner-name]", data.owner.name);
    setText("[data-owner-property-count]", data.properties.length);
    setText("[data-owner-report-count]", data.reports.length);
    setText("[data-owner-last-report]", data.reports[0] ? formatDate(getReportDate(data.reports[0])) : "Aucun rapport");

    const reportsByProperty = new Map();
    data.reports.forEach((report) => {
      reportsByProperty.set(report.property_id, [...(reportsByProperty.get(report.property_id) || []), report]);
    });

    const container = qs("[data-owner-properties]");
    if (!container) return;

    if (!data.properties.length) {
      container.innerHTML = '<div class="owner-empty">Aucun logement n’est relié à ce compte propriétaire.</div>';
      return;
    }

    container.innerHTML = data.properties
      .map((property) => {
        const reports = reportsByProperty.get(property.id) || [];
        const coverUrl = getPropertyCover(property);
        const cover = coverUrl
          ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(property.name)}" loading="lazy">`
          : '<div class="owner-property-placeholder">Photo du logement à ajouter</div>';

        const reportCards = reports.length
          ? reports
              .map(
                (report) => `
                  <a class="owner-report-card" href="./rapport.html?id=${encodeURIComponent(report.id)}">
                    <h3>Rapport ménage — ${escapeHtml(property.name)}</h3>
                    <p class="owner-muted">${formatDate(getReportDate(report))} · Intervenant(e) : ${escapeHtml(getReportCleaner(report))}</p>
                    <p class="owner-muted"><strong>Commentaire :</strong> ${escapeHtml(getReportCommentPreview(report))}</p>
                    <div class="owner-mini-stats">
                      <span class="owner-mini-stat">Checklist <strong>${reportChecklistScore(report)}</strong></span>
                      <span class="owner-mini-stat">Photos <strong>${Array.isArray(report.photos) ? report.photos.length : 0}</strong></span>
                      <span class="owner-mini-stat"><strong>Voir le rapport →</strong></span>
                    </div>
                  </a>
                `,
              )
              .join("")
          : '<div class="owner-empty">Aucun rapport ménage pour ce logement pour le moment.</div>';

        return `
          <article class="owner-property">
            <div class="owner-property-grid">
              <div class="owner-property-cover">${cover}</div>
              <div class="owner-property-content">
                <div class="owner-property-head">
                  <div>
                    <h2>${escapeHtml(property.name || "Logement")}</h2>
                    <p class="owner-muted">${escapeHtml(property.city || property.country || "Adresse non renseignée")}</p>
                  </div>
                  <span class="owner-pill">${reports.length} rapport(s)</span>
                </div>
                ${reportCards}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function initDashboardPage() {
    const session = requireSession();
    if (!session) return;

    qsa("[data-owner-logout]").forEach((button) => button.addEventListener("click", signOut));

    try {
      const data = await getDashboardData(session);
      renderDashboard(data);
      qs("[data-owner-loading]")?.remove();
      qs("[data-owner-content]").hidden = false;
    } catch (error) {
      qs("[data-owner-loading]")?.remove();
      showAlert(error.message || "Impossible de charger votre espace propriétaire.");
    }
  }

  function renderReportDetail({ report, property }) {
    setText("[data-report-property]", property.name || "Logement");
    setText("[data-report-date]", formatDateTime(getReportDate(report)));
    setText("[data-report-mission]", "Rapport ménage");
    setText("[data-report-cleaner]", getReportCleaner(report));
    setText("[data-report-guest]", getReportGuest(report));
    setText("[data-report-checklist-score]", reportChecklistScore(report));
    setText("[data-report-photo-count]", Array.isArray(report.photos) ? report.photos.length : 0);

    const cover = qs("[data-report-cover]");
    const coverUrl = getPropertyCover(property);
    if (cover && coverUrl) {
      cover.innerHTML = `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(property.name)}">`;
    }

    const commentSection = qs("[data-report-comment-section]");
    if (commentSection) {
      const paragraph = qs("[data-report-comment]", commentSection);
      if (paragraph) paragraph.textContent = getReportComment(report) || "Aucun commentaire renseigné.";
      commentSection.hidden = false;
    }

    const checklist = normalizeChecklist(report.checklist);
    const checklistContainer = qs("[data-report-checklist]");
    if (checklistContainer) {
      checklistContainer.innerHTML = checklist.length
        ? checklist
            .map(
              (item) => `
                <div class="owner-checklist-item">
                  <span>${escapeHtml(item.label)}</span>
                  <span class="${item.checked ? "owner-status-ok" : "owner-status-ko"}">${item.checked ? "Validé" : "À vérifier"}</span>
                </div>
              `,
            )
            .join("")
        : '<div class="owner-empty">Aucune checklist n’est attachée à ce rapport.</div>';
    }

    const photos = Array.isArray(report.photos) ? report.photos : [];
    const gallery = qs("[data-report-gallery]");
    if (gallery) {
      gallery.innerHTML = photos.length
        ? photos
            .map((photo, index) => {
              const url = getFileUrl(photo, "cleaning-reports");
              if (!url) return "";
              return `
                <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
                  <img src="${escapeHtml(url)}" alt="Photo ménage ${index + 1}" loading="lazy">
                </a>
              `;
            })
            .join("")
        : '<div class="owner-empty">Aucune photo n’est attachée à ce rapport.</div>';
    }
  }

  async function initReportPage() {
    const session = requireSession();
    if (!session) return;

    qsa("[data-owner-logout]").forEach((button) => button.addEventListener("click", signOut));

    const reportId = new URLSearchParams(window.location.search).get("id");
    if (!reportId) {
      showAlert("Identifiant de rapport manquant.");
      qs("[data-owner-loading]")?.remove();
      return;
    }

    try {
      const detail = await getReportDetail(session, reportId);
      renderReportDetail(detail);
      qs("[data-owner-loading]")?.remove();
      qs("[data-owner-content]").hidden = false;
    } catch (error) {
      qs("[data-owner-loading]")?.remove();
      showAlert(error.message || "Impossible de charger le rapport.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.matches("[data-page='owner-login']")) initLoginPage();
    if (document.body.matches("[data-page='owner-dashboard']")) initDashboardPage();
    if (document.body.matches("[data-page='owner-report']")) initReportPage();
  });
})();
