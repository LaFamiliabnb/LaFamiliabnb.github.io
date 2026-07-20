(() => {
  const SESSION_KEY = "lafamilia_admin_session";
  const ALL_ASSIGNEES = "__all";
  const UNASSIGNED = "__unassigned";
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";

  let latestDashboardData = null;

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
      pending_admin: "Attente confirmation",
      approved: "Validé",
      rejected: "Refusé",
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

  function statusStyle(status) {
    if (status === "pending_admin") return "background:#fff3cd;color:#8a5a00;border-color:#f6c343;";
    if (["approved", "synced", "completed"].includes(status)) return "background:#d1fae5;color:#065f46;border-color:#34d399;";
    if (["rejected", "failed", "cancelled"].includes(status)) return "background:#fee2e2;color:#991b1b;border-color:#f87171;";
    return "";
  }

  function statusBadge(status) {
    return `<span class="owner-mini-stat" style="${statusStyle(status)}">${escapeHtml(formatStatus(status))}</span>`;
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

  function assigneeName(mission) {
    return String(mission.assigned_team_member_name || "").replace(/\s+/g, " ").trim();
  }

  function staffName(staffMember) {
    return String(staffMember?.staff_name || "").replace(/\s+/g, " ").trim();
  }

  function assigneeMatches(mission, selectedAssignee) {
    if (!selectedAssignee || selectedAssignee === ALL_ASSIGNEES) return true;
    const name = assigneeName(mission);
    if (selectedAssignee === UNASSIGNED) return !name;
    return name === selectedAssignee;
  }

  function assigneeOptions(missions, staffMembers = []) {
    return Array.from(
      new Set([
        ...staffMembers.map(staffName).filter(Boolean),
        ...missions.map(assigneeName).filter(Boolean),
      ]),
    ).sort((a, b) => a.localeCompare(b, "fr"));
  }

  function updateAssigneeFilterOptions(missions, staffMembers = [], selectedValue = ALL_ASSIGNEES) {
    const select = qs("[data-admin-assignee-filter]");
    if (!select) return;

    const names = assigneeOptions(missions, staffMembers);
    const hasUnassigned = missions.some((mission) => !assigneeName(mission));
    const options = [
      `<option value="${ALL_ASSIGNEES}">Tous les intervenants</option>`,
      ...(hasUnassigned ? [`<option value="${UNASSIGNED}">Sans intervenant</option>`] : []),
      ...names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`),
    ];

    select.innerHTML = options.join("");
    select.value = names.includes(selectedValue) || selectedValue === UNASSIGNED ? selectedValue : ALL_ASSIGNEES;
  }

  function renderMissionAssigneeOptions(mission, staffMembers = []) {
    const currentId = mission.team_member_id ? String(mission.team_member_id) : "";
    const currentName = assigneeName(mission);
    const optionRows = [`<option value="">Sans intervenant</option>`];
    const knownIds = new Set();

    staffMembers.forEach((staffMember) => {
      const id = staffMember.team_member_id ? String(staffMember.team_member_id) : "";
      const name = staffName(staffMember);
      if (!id || !name || knownIds.has(id)) return;
      knownIds.add(id);
      const selected = currentId && currentId === id ? " selected" : "";
      optionRows.push(
        `<option value="${escapeHtml(id)}" data-staff-id="${escapeHtml(id)}" data-staff-name="${escapeHtml(name)}"${selected}>${escapeHtml(name)}</option>`,
      );
    });

    if (currentName && (!currentId || !knownIds.has(currentId))) {
      const value = currentId || `current:${currentName}`;
      optionRows.push(
        `<option value="${escapeHtml(value)}" data-staff-id="${escapeHtml(currentId)}" data-staff-name="${escapeHtml(currentName)}" selected>${escapeHtml(currentName)} — intervenant actuel</option>`,
      );
    }

    return optionRows.join("");
  }

  async function loadDashboardData(session, dateValue) {
    await requireAdmin(session);
    const range = dayRange(dateValue);

    const properties = await supabaseFetch(
      "/rest/v1/nowistay_properties?select=id,name,source,owner_id,city,country,address_line1,capacity,property_type,payload&order=name.asc&limit=1000",
      { accessToken: session.accessToken },
    );

    const missions = await supabaseFetch(
      `/rest/v1/nowistay_missions?select=id,property_id,type,status,title,description,scheduled_at,duration_minutes,team_member_id,assigned_team_member_name,property_name,booking_guest_name,booking_arrival,booking_departure&scheduled_at=gte.${range.start}&scheduled_at=lt.${range.end}&status=neq.cancelled&order=scheduled_at.asc&limit=500`,
      { accessToken: session.accessToken },
    );

    const requests = await supabaseFetch(
      "/rest/v1/owner_intervention_requests?select=id,property_id,intervention_type,requested_for,time_window,title,description,urgency,status,created_at,nowistay_mission_id,sync_error&status=neq.cancelled&order=requested_for.asc&limit=500",
      { accessToken: session.accessToken },
    );

    const staffMembers = await supabaseFetch("/rest/v1/rpc/get_admin_staff_members", {
      method: "POST",
      accessToken: session.accessToken,
      body: {},
    });

    return { properties, missions, requests, staffMembers };
  }

  function renderMissions(missions, propertiesById, staffMembers = []) {
    const container = qs("[data-admin-missions]");
    if (!container) return;

    if (!missions.length) {
      container.innerHTML = '<div class="owner-empty">Aucune intervention ne correspond à ces filtres.</div>';
      return;
    }

    container.innerHTML = missions
      .map((mission) => {
        const property = propertiesById.get(String(mission.property_id));
        const propertyName = property?.name || mission.property_name || "Logement";
        const currentAssignee = assigneeName(mission);
        return `
          <div class="owner-report-card">
            <h3>${formatTime(mission.scheduled_at)} — ${formatType(mission.type)} — ${escapeHtml(propertyName)}</h3>
            <p class="owner-muted">${escapeHtml(propertyLocation(property) || "Adresse non renseignée")}</p>
            <div class="owner-mini-stats">
              ${statusBadge(mission.status)}
              <span class="owner-mini-stat">${sourceLabel(property)}</span>
              <span class="owner-mini-stat">Intervenant(e) : ${escapeHtml(currentAssignee || "Non renseigné")}</span>
            </div>
            ${mission.booking_guest_name ? `<p class="owner-muted">Voyageur : ${escapeHtml(mission.booking_guest_name)}</p>` : ""}
            ${mission.description ? `<p class="owner-muted">${escapeHtml(mission.description)}</p>` : ""}
            <form class="owner-form" data-admin-assignee-form data-mission-id="${escapeHtml(mission.id)}">
              <label class="owner-label">
                Changer l’intervenant(e)
                <select class="owner-input" name="assignedTeamMember">
                  ${renderMissionAssigneeOptions(mission, staffMembers)}
                </select>
              </label>
              <button class="owner-button owner-secondary-button" type="submit">Enregistrer l’intervenant(e)</button>
              <p class="owner-muted" data-assignee-feedback hidden></p>
            </form>
          </div>
        `;
      })
      .join("");
  }

  function requestActionButtons(request) {
    if (request.status === "pending_admin") {
      return `
        <div class="owner-mini-stats">
          <button class="owner-button owner-secondary-button" type="button" data-request-action="approved" data-request-id="${escapeHtml(request.id)}">Valider</button>
          <button class="owner-button owner-secondary-button" type="button" data-request-action="rejected" data-request-id="${escapeHtml(request.id)}">Refuser</button>
        </div>
      `;
    }

    if (request.status === "internal_pending") {
      return `
        <div class="owner-mini-stats">
          <button class="owner-button owner-secondary-button" type="button" data-request-action="completed" data-request-id="${escapeHtml(request.id)}">Marquer terminée</button>
          <button class="owner-button owner-secondary-button" type="button" data-request-action="cancelled" data-request-id="${escapeHtml(request.id)}">Annuler</button>
        </div>
      `;
    }

    return "";
  }

  function renderRequests(requests, propertiesById) {
    const container = qs("[data-admin-requests]");
    if (!container) return;

    const visibleRequests = requests.filter((request) => ["pending_admin", "internal_pending", "failed"].includes(request.status));

    if (!visibleRequests.length) {
      container.innerHTML = '<div class="owner-empty">Aucune demande propriétaire à traiter.</div>';
      return;
    }

    container.innerHTML = visibleRequests
      .map((request) => {
        const property = propertiesById.get(String(request.property_id));
        const propertyName = property?.name || "Logement";
        const timeWindow = request.time_window ? ` · ${escapeHtml(request.time_window)}` : "";
        return `
          <div class="owner-report-card">
            <h3>${formatType(request.intervention_type)} — ${escapeHtml(propertyName)}</h3>
            <p class="owner-muted">${formatDateTime(request.requested_for)}${timeWindow}</p>
            <div class="owner-mini-stats">
              ${statusBadge(request.status)}
              <span class="owner-mini-stat">${sourceLabel(property)}</span>
              <span class="owner-mini-stat">Urgence : ${escapeHtml(request.urgency || "normal")}</span>
            </div>
            ${request.description ? `<p class="owner-muted">${escapeHtml(request.description)}</p>` : ""}
            ${request.sync_error ? `<p class="owner-muted">Erreur : ${escapeHtml(request.sync_error)}</p>` : ""}
            ${requestActionButtons(request)}
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

  function renderDashboard(data, selectedAssignee = ALL_ASSIGNEES) {
    latestDashboardData = data;
    const propertiesById = new Map(data.properties.map((property) => [String(property.id), property]));
    const pendingRequests = data.requests.filter((request) => request.status === "pending_admin");
    const filteredMissions = data.missions.filter((mission) => assigneeMatches(mission, selectedAssignee));

    setText("[data-admin-property-count]", data.properties.length);
    setText("[data-admin-mission-count]", filteredMissions.length);
    setText("[data-admin-request-count]", pendingRequests.length);

    renderMissions(filteredMissions, propertiesById, data.staffMembers || []);
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

  async function updateMissionAssignee(session, missionId, teamMemberId, assignedTeamMemberName) {
    return supabaseFetch(`/rest/v1/nowistay_missions?id=eq.${encodeURIComponent(missionId)}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      prefer: "return=representation",
      body: {
        team_member_id: teamMemberId ? Number(teamMemberId) : null,
        assigned_team_member_name: assignedTeamMemberName || null,
      },
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
    const assigneeFilter = qs("[data-admin-assignee-filter]");
    if (dateInput && !dateInput.value) dateInput.value = todayInputValue();

    const load = async () => {
      try {
        const selectedBeforeLoad = assigneeFilter?.value || ALL_ASSIGNEES;
        const data = await loadDashboardData(session, dateInput?.value || todayInputValue());
        updateAssigneeFilterOptions(data.missions, data.staffMembers || [], selectedBeforeLoad);
        renderDashboard(data, assigneeFilter?.value || ALL_ASSIGNEES);
        qs("[data-admin-loading]")?.remove();
        qs("[data-admin-content]").hidden = false;
      } catch (error) {
        qs("[data-admin-loading]")?.remove();
        showAlert(error.message || "Impossible de charger l’admin.");
      }
    };

    qs("[data-admin-filters-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await load();
    });

    assigneeFilter?.addEventListener("change", () => {
      if (!latestDashboardData) return;
      renderDashboard(latestDashboardData, assigneeFilter.value || ALL_ASSIGNEES);
    });

    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-admin-assignee-form]");
      if (!form) return;
      event.preventDefault();

      const button = qs("button[type='submit']", form);
      const feedback = qs("[data-assignee-feedback]", form);
      const missionId = form.dataset.missionId;
      const select = qs("select[name='assignedTeamMember']", form);
      const selectedOption = select?.selectedOptions?.[0];
      const teamMemberId = selectedOption?.dataset.staffId || "";
      const assignedTeamMemberName = String(selectedOption?.dataset.staffName || "").replace(/\s+/g, " ").trim();

      if (button) {
        button.disabled = true;
        button.textContent = "Enregistrement…";
      }

      try {
        await updateMissionAssignee(session, missionId, teamMemberId, assignedTeamMemberName);
        if (feedback) {
          feedback.textContent = "Intervenant(e) mis(e) à jour dans Supabase.";
          feedback.hidden = false;
        }
        await load();
      } catch (error) {
        if (feedback) {
          feedback.textContent = error.message || "Impossible de mettre à jour l’intervenant(e).";
          feedback.hidden = false;
        } else {
          showAlert(error.message || "Impossible de mettre à jour l’intervenant(e).");
        }
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Enregistrer l’intervenant(e)";
        }
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-request-action]");
      if (!button) return;

      const requestId = button.dataset.requestId;
      const status = button.dataset.requestAction;
      button.disabled = true;
      button.textContent = status === "approved" ? "Validation…" : status === "rejected" ? "Refus…" : "Mise à jour…";

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