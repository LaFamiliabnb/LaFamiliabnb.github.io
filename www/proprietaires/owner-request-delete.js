(() => {
  const SESSION_KEY = "lafamilia_owner_session";
  const CANCELLABLE_STATUSES = new Set(["pending_admin", "pending_sync", "internal_pending", "approved", "rejected"]);
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
      const message = payload && typeof payload === "object" && payload.message ? payload.message : "Impossible de supprimer cette demande.";
      throw new Error(message);
    }

    return payload;
  }

  async function loadOwnerRequests(session) {
    return supabaseFetch(
      `/rest/v1/owner_intervention_requests?select=id,property_id,intervention_type,requested_for,status,nowistay_mission_id&auth_user_id=eq.${session.user.id}&status=neq.cancelled&order=requested_for.asc&limit=100`,
      { accessToken: session.accessToken },
    );
  }

  function canCancel(request) {
    return request && !request.nowistay_mission_id && CANCELLABLE_STATUSES.has(request.status);
  }

  async function cancelOwnerRequest(session, requestId) {
    return supabaseFetch(
      `/rest/v1/owner_intervention_requests?id=eq.${encodeURIComponent(requestId)}&auth_user_id=eq.${encodeURIComponent(session.user.id)}`,
      {
        method: "PATCH",
        accessToken: session.accessToken,
        prefer: "return=minimal",
        body: {
          status: "cancelled",
          updated_at: new Date().toISOString(),
        },
      },
    );
  }

  function addMessage(card, message, type = "info") {
    let element = card.querySelector("[data-owner-delete-message]");
    if (!element) {
      element = document.createElement("p");
      element.className = "owner-muted";
      element.dataset.ownerDeleteMessage = "true";
      element.style.marginTop = "0.75rem";
      card.appendChild(element);
    }
    element.textContent = message;
    element.style.color = type === "error" ? "#991b1b" : "";
  }

  function decorateOwnerRequestCards(requests, session) {
    const requestCards = Array.from(document.querySelectorAll(".owner-report-card"))
      .filter((card) => card.textContent.includes("Demande propriétaire"));

    requestCards.forEach((card, index) => {
      const request = requests[index];
      if (!request || card.dataset.ownerDeleteDecorated === "true") return;

      card.dataset.ownerDeleteDecorated = "true";

      if (!canCancel(request)) {
        if (request.nowistay_mission_id) {
          addMessage(card, "Cette demande est déjà synchronisée : contactez La Familia pour la modifier.");
        }
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "owner-button owner-secondary-button";
      button.textContent = "Supprimer ma demande";
      button.style.marginTop = "0.75rem";
      button.style.width = "100%";

      button.addEventListener("click", async () => {
        const confirmed = window.confirm("Supprimer cette demande d’intervention ? Elle ne sera plus visible dans votre espace propriétaire.");
        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Suppression…";

        try {
          await cancelOwnerRequest(session, request.id);
          addMessage(card, "Demande supprimée.");
          card.style.opacity = "0.45";
          window.setTimeout(() => window.location.reload(), 700);
        } catch (error) {
          button.disabled = false;
          button.textContent = "Supprimer ma demande";
          addMessage(card, error.message || "Impossible de supprimer cette demande.", "error");
        }
      });

      card.appendChild(button);
    });
  }

  async function init() {
    if (!document.body.matches("[data-page='owner-dashboard']")) return;
    const session = getSession();
    if (!session?.accessToken || !session?.user?.id) return;

    try {
      const requests = await loadOwnerRequests(session);
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        decorateOwnerRequestCards(requests, session);
        if (attempts > 20 || document.querySelector("[data-owner-delete-message], .owner-report-card button")) {
          window.clearInterval(timer);
        }
      }, 300);
    } catch (_error) {
      // Le bouton de suppression ne doit pas bloquer le dashboard propriétaire.
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
