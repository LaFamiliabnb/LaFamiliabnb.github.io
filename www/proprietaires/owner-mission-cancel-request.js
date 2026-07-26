(() => {
  const SESSION_KEY = "lafamilia_owner_session";
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";

  function isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("ton-projet") && !supabaseAnonKey.includes("ta_anon_key"));
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  async function supabaseFetch(path, options = {}) {
    if (!isConfigured()) throw new Error("Supabase n’est pas configuré.");

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
      const message = payload && typeof payload === "object" && payload.message ? payload.message : "Impossible d’enregistrer la demande.";
      throw new Error(message);
    }

    return payload;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(date) {
    if (!date) return "date non renseignée";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function isCancellationRequest(request) {
    const type = String(request.intervention_type || "").toLowerCase();
    const title = String(request.title || "").toLowerCase();
    const description = String(request.description || "").toLowerCase();
    return type === "cancellation" || title.includes("annulation") || description.includes("annulation");
  }

  function addMessage(card, message, type = "info") {
    let element = card.querySelector("[data-owner-cancel-message]");
    if (!element) {
      element = document.createElement("p");
      element.className = "owner-muted";
      element.dataset.ownerCancelMessage = "true";
      element.style.marginTop = "0.75rem";
      card.appendChild(element);
    }
    element.textContent = message;
    element.style.color = type === "error" ? "#991b1b" : "";
  }

  function decorateCancellationRequestLabels(futureItems, cards) {
    cards.forEach((card, index) => {
      const item = futureItems[index];
      if (!item || item.source !== "request" || !isCancellationRequest(item)) return;
      const heading = card.querySelector("h3");
      if (heading && !heading.textContent.trim().startsWith("Annulation")) {
        const propertyName = item.propertyName || "Logement";
        heading.textContent = `Annulation — ${propertyName}`;
      }
    });
  }

  async function getOwnerDashboardScope(session) {
    const accounts = await supabaseFetch(
      `/rest/v1/owner_accounts?select=id,auth_user_id,name,email,nowistay_owner_id,created_at&auth_user_id=eq.${session.user.id}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!accounts.length) return null;
    const owner = accounts[0];

    const ownerAccess = await supabaseFetch(
      `/rest/v1/owner_property_access?select=property_id&auth_user_id=eq.${session.user.id}`,
      { accessToken: session.accessToken },
    ).catch(() => []);

    const accessPropertyIds = (ownerAccess || []).map((row) => row.property_id).filter(Boolean);
    const propertiesPath = accessPropertyIds.length
      ? `/rest/v1/nowistay_properties?select=id,name,owner_id,city,country,payload&id=in.(${accessPropertyIds.join(",")})&order=name.asc`
      : `/rest/v1/nowistay_properties?select=id,name,owner_id,city,country,payload&owner_id=eq.${owner.nowistay_owner_id}&order=name.asc`;

    const properties = await supabaseFetch(propertiesPath, { accessToken: session.accessToken });
    const propertyIds = properties.map((property) => property.id);

    if (!propertyIds.length) return { owner, properties, futureItems: [] };

    const now = encodeURIComponent(new Date().toISOString());
    const futureInterventions = await supabaseFetch(
      `/rest/v1/nowistay_missions?select=id,property_id,type,status,title,description,scheduled_at,duration_minutes,assigned_team_member_name,property_name&property_id=in.(${propertyIds.join(",")})&scheduled_at=gte.${now}&status=neq.cancelled&order=scheduled_at.asc&limit=200`,
      { accessToken: session.accessToken },
    );

    const interventionRequests = await supabaseFetch(
      `/rest/v1/owner_intervention_requests?select=id,property_id,intervention_type,requested_for,time_window,title,description,urgency,status,nowistay_mission_id,created_at&auth_user_id=eq.${session.user.id}&status=neq.cancelled&order=requested_for.asc&limit=100`,
      { accessToken: session.accessToken },
    );

    const propertiesById = new Map(properties.map((property) => [String(property.id), property]));
    const futureItems = [
      ...(futureInterventions || []).map((item) => {
        const property = propertiesById.get(String(item.property_id));
        return {
          source: "mission",
          id: item.id,
          propertyId: item.property_id,
          type: item.type,
          status: item.status,
          scheduledAt: item.scheduled_at,
          title: item.title,
          description: item.description,
          propertyName: property?.name || item.property_name || item.title || "Logement",
        };
      }),
      ...(interventionRequests || []).map((item) => {
        const property = propertiesById.get(String(item.property_id));
        return {
          source: "request",
          id: item.id,
          propertyId: item.property_id,
          type: item.intervention_type,
          status: item.status,
          scheduledAt: item.requested_for,
          title: item.title,
          description: item.description,
          timeWindow: item.time_window,
          nowistayMissionId: item.nowistay_mission_id,
          propertyName: property?.name || item.title || "Logement",
        };
      }),
    ]
      .filter((item) => item.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 20);

    return { owner, properties, futureItems, interventionRequests };
  }

  async function createCancellationRequest(session, owner, mission) {
    const title = `Demande d’annulation - ${mission.title || mission.propertyName || "Intervention"}`;
    const description = `Le propriétaire demande l’annulation de l’intervention planifiée “${mission.title || "Ménage"}” du ${formatDateTime(mission.scheduledAt)}. Mission concernée : ${mission.id}.`;

    return supabaseFetch("/rest/v1/owner_intervention_requests", {
      method: "POST",
      accessToken: session.accessToken,
      prefer: "return=representation",
      body: {
        nowistay_owner_id: owner.nowistay_owner_id,
        property_id: mission.propertyId,
        intervention_type: "cancellation",
        requested_for: mission.scheduledAt,
        time_window: null,
        title,
        description,
        urgency: "normal",
        nowistay_mission_id: mission.id,
      },
    });
  }

  function decorateMissionCards(scope, session) {
    const section = document.querySelector("[data-owner-future-section]");
    if (!section) return;

    const cards = Array.from(section.querySelectorAll(".owner-report-card"));
    if (!cards.length) return;

    const futureItems = scope.futureItems || [];
    decorateCancellationRequestLabels(futureItems, cards);

    const cancellationRequestsByMissionId = new Map(
      (scope.interventionRequests || [])
        .filter((request) => request.nowistay_mission_id && isCancellationRequest(request))
        .map((request) => [String(request.nowistay_mission_id), request]),
    );

    cards.forEach((card, index) => {
      const item = futureItems[index];
      if (!item || item.source !== "mission" || card.dataset.ownerCancelDecorated === "true") return;

      card.dataset.ownerCancelDecorated = "true";

      const existingRequest = cancellationRequestsByMissionId.get(String(item.id));
      if (existingRequest) {
        addMessage(card, "Annulation déjà demandée. La Familia doit valider.");
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "owner-button owner-secondary-button";
      button.textContent = "Demander l’annulation";
      button.style.marginTop = "0.75rem";
      button.style.width = "100%";

      button.addEventListener("click", async () => {
        const confirmed = window.confirm("Envoyer une demande d’annulation pour cette intervention ? La Familia devra la valider.");
        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Envoi de la demande…";

        try {
          await createCancellationRequest(session, scope.owner, item);
          button.remove();
          addMessage(card, "Demande d’annulation envoyée. La Familia doit valider.");
        } catch (error) {
          button.disabled = false;
          button.textContent = "Demander l’annulation";
          addMessage(card, error.message || "Impossible d’envoyer la demande d’annulation.", "error");
        }
      });

      card.appendChild(button);
    });
  }

  async function apply() {
    if (!document.body.matches("[data-page='owner-dashboard']")) return;
    const session = getSession();
    if (!session?.accessToken) return;

    try {
      const scope = await getOwnerDashboardScope(session);
      if (!scope) return;
      decorateMissionCards(scope, session);
    } catch (error) {
      // Ne bloque jamais le dashboard principal si le helper échoue.
      console.warn("Impossible d’ajouter les demandes d’annulation propriétaire", error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    window.setTimeout(apply, 800);
    window.setTimeout(apply, 1600);

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
