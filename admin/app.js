(() => {
  const SESSION_KEY = "lafamilia_admin_session";
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

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(selector, value) {
    const element = qs(selector);
    if (element) element.textContent = value;
  }

  function showAlert(message, type = "error") {
    const alert = qs("[data-admin-alert]");
    if (!alert) return;
    alert.textContent = message;
    alert.className = `owner-alert ${type}`;
    alert.hidden = false;
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
      throw new Error("Supabase n’est pas configuré. Vérifie proprietaires/config.js.");
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

    await requireAdmin(session);
    saveSession(session);
    return session;
  }

  async function signOut() {
    const session = getSession();
    if (session?.accessToken) {
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

  async function requireAdmin(session) {
    const admins = await supabaseFetch(
      `/rest/v1/admin_accounts?select=id,name,email,auth_user_id&auth_user_id=eq.${session.user.id}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!admins.length) {
      throw new Error("Ce compte n’a pas accès à l’administration La Familia.");
    }

    return admins[0];
  }

  function todayInputValue() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dayRange(dateValue) {
    const [year, month, day] = String(dateValue || todayInputValue()).split("-").map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    return {
      start: encodeURIComponent(start.toISOString()),
      end: encodeURIComponent(end.toISOString()),
    };
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

  function formatTime(date) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function formatType(type) {
    if (type === "maintenance") return "Maintenance";
    if (type === "cleaning") return "Ménage";
    return type || "Intervention";
  }

  function formatStatus(status) {
    const labels = {
      assigned: "Planifiée",
      pending_host: "À confirmer",
      pending_sync: "À synchroniser Nowistay",
      internal_pending: "Interne La Familia",
      synced: "Synchronisée Nowistay",
      failed: "Erreur",
      completed: "Terminée",
      cancelled: "Annulée",
    };
    return labels[status] || status || "À confirmer";
  }

  function propertyLocation(property) {
    const payload = property?.payload || {};
    const address = payload.address || {};
    return [property?.address_line1 || address.line1, property?.city || address.city, property?.country || address.country]
      .filter(Boolean)
      .join(" · ");
  }

  function sourceLabel(property) {
    return property?.source === "manual" ? "Manuel" : "Nowistay";
  }

  async function loadDashboardData(session, dateValue) {
    await requireAdmin(session);
    const range = dayRange(dateValue);

    const properties = await supabaseFetch(
      "/rest/v1/nowistay_properties?select=id,name,source,owner_id,city,country,address_line1,capacity,property_type,payload&order=name.asc&limit=1000",
      { accessToken: session.accessToken },
    );

    const missions = await supabaseFetch(
      `/rest/v1/nowistay_missions?select=id,property_id,type,status,title,description,scheduled_at,duration_minutes,assigned_team_member_name,property_name,booking_guest_name,booking_arrival,booking_departure&scheduled_at=gte.${range.start}&scheduled_at=lt.${range.end}&status=neq.cancelled&order=scheduled_at.asc&limit=500`,
      { accessToken: session.accessToken },
    );

    const requests = await supabaseFetch(
      "/rest/v1/owner_intervention_requests?select=id,property_id,intervention_type,requested_for,time_window,title,description,urgency,status,created_at,nowistay_mission_id&status=neq.cancelled&order=requested_for.asc&limit=500",
      { accessToken: session.accessToken },
    );

    return { properties, missions, requests };
  }

  function renderMissions(missions, propertiesById) {
    const container = qs("[data-admin-missions]");
    if (!container) return;

    if (!missions.length) {
      container.innerHTML = '<div class="owner-empty">Aucune intervention Nowistay sur cette journée.</div>';
      return;
    }

    container.innerHTML = missions
      .map((mission) => {
        const property = propertiesById.get(String(mission.property_id));
        const propertyName = property?.name || mission.property_name || "Logement";
        return `
          <div class="owner-report-card">
            <h3>${formatTime(mission.scheduled_at)} — ${formatType(mission.type)} — ${escapeHtml(propertyName)}</h3>
            <p class="owner-muted">${escapeHtml(propertyLocation(property) || "Adresse non renseignée")}</p>
            <div class="owner-mini-stats">
              <span class="owner-mini-stat">${formatStatus(mission.status)}</span>
              <span class="owner-mini-stat">${sourceLabel(property)}</span>
              ${mission.assigned_team_member_name ? `<span class="owner-mini-stat">Intervenant(e) : ${escapeHtml(mission.assigned_team_member_name)}</span>` : ""}
            </div>
            ${mission.booking_guest_name ? `<p class="owner-muted">Voyageur : ${escapeHtml(mission.booking_guest_name)}</p>` : ""}
            ${mission.description ? `<p class="owner-muted">${escapeHtml(mission.description)}</p>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function renderRequests(requests, propertiesById) {
    const container = qs("[data-admin-requests]");
    if (!container) return;

    const activeRequests = requests.filter((request) => !["completed", "cancelled"].includes(request.status));

    if (!activeRequests.length) {
      container.innerHTML = '<div class="owner-empty">Aucune demande propriétaire à traiter.</div>';
      return;
    }

    container.innerHTML = activeRequests
      .map((request) => {
        const property = propertiesById.get(String(request.property_id));
        const propertyName = property?.name || "Logement";
        const isInternal = request.status === "internal_pending";
        const timeWindow = request.time_window ? ` · ${escapeHtml(request.time_window)}` : "";
        return `
          <div class="owner-report-card">
            <h3>${formatType(request.intervention_type)} — ${escapeHtml(propertyName)}</h3>
            <p class="owner-muted">${formatDateTime(request.requested_for)}${timeWindow}</p>
            <div class="owner-mini-stats">
              <span class="owner-mini-stat">${formatStatus(request.status)}</span>
              <span class="owner-mini-stat">${sourceLabel(property)}</span>
              <span class="owner-mini-stat">Urgence : ${escapeHtml(request.urgency || "normal")}</span>
            </div>
            ${request.description ? `<p class="owner-muted">${escapeHtml(request.description)}</p>` : ""}
            ${isInternal ? `
              <div class="owner-mini-stats">
                <button class="owner-button owner-secondary-button" type="button" data-request-action="completed" data-request-id="${escapeHtml(request.id)}">Marquer terminée</button>
                <button class="owner-button owner-secondary-button" type="button" data-request-action="cancelled" data-request-id="${escapeHtml(request.id)}">Annuler</button>
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");
  }

  function renderProperties(properties) {
    const container = qs("[data-admin-properties]");
    if (!container) return;

    container.innerHTML = properties
      .map((property) => `
        <div class="owner-report-card">
          <h3>${escapeHtml(property.name || "Logement")}</h3>
          <p class="owner-muted">${escapeHtml(propertyLocation(property) || "Adresse non renseignée")}</p>
          <div class="owner-mini-stats">
            <span class="owner-mini-stat">ID ${escapeHtml(property.id)}</span>
            <span class="owner-mini-stat">${sourceLabel(property)}</span>
            ${property.capacity ? `<span class="owner-mini-stat">${escapeHtml(property.capacity)} personne(s)</span>` : ""}
          </div>
        </div>
      `)
      .join("");
  }

  function renderDashboard(data) {
    const propertiesById = new Map(data.properties.map((property) => [String(property.id), property]));
    const activeRequests = data.requests.filter((request) => !["completed", "cancelled"].includes(request.status));

    setText("[data-admin-property-count]", data.properties.length);
    setText("[data-admin-mission-count]", data.missions.length);
    setText("[data-admin-request-count]", activeRequests.length);

    renderMissions(data.missions, propertiesById);
    renderRequests(data.requests, propertiesById);
    renderProperties(data.properties);
  }

  async function updateRequestStatus(session, requestId, status) {
    return supabaseFetch(`/rest/v1/owner_intervention_requests?id=eq.${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      prefer: "return=representation",
      body: { status },
    });
  }

  function initLoginPage() {
    const form = qs("[data-admin-login-form]");
    const button = qs("[data-admin-login-button]");

    if (!isConfigured()) {
      showAlert("Supabase n’est pas encore configuré.");
      if (button) button.disabled = true;
      return;
    }

    if (getSession()) {
      window.location.href = "./dashboard.html";
      return;
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = qs("#admin-email")?.value.trim();
      const password = qs("#admin-password")?.value;

      if (!email || !password) {
        showAlert("Renseigne l’email et le mot de passe.");
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = "Connexion…";
      }

      try {
        await signIn(email, password);
        window.location.href = "./dashboard.html";
      } catch (error) {
        showAlert(error.message || "Connexion impossible.");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Entrer dans l’admin";
        }
      }
    });
  }

  async function initDashboardPage() {
    const session = getSession();
    if (!session) {
      window.location.href = "./login.html";
      return;
    }

    qsa("[data-admin-logout]").forEach((button) => button.addEventListener("click", signOut));

    const dateInput = qs("[data-admin-date]");
    if (dateInput && !dateInput.value) dateInput.value = todayInputValue();

    const load = async () => {
      try {
        const data = await loadDashboardData(session, dateInput?.value || todayInputValue());
        renderDashboard(data);
        qs("[data-admin-loading]")?.remove();
        qs("[data-admin-content]").hidden = false;
      } catch (error) {
        qs("[data-admin-loading]")?.remove();
        showAlert(error.message || "Impossible de charger l’admin.");
      }
    };

    qs("[data-admin-date-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await load();
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-request-action]");
      if (!button) return;

      const requestId = button.dataset.requestId;
      const status = button.dataset.requestAction;
      button.disabled = true;
      button.textContent = "Mise à jour…";

      try {
        await updateRequestStatus(session, requestId, status);
        await load();
      } catch (error) {
        showAlert(error.message || "Impossible de mettre à jour la demande.");
      }
    });

    await load();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.matches("[data-page='admin-login']")) initLoginPage();
    if (document.body.matches("[data-page='admin-dashboard']")) initDashboardPage();
  });
})();
