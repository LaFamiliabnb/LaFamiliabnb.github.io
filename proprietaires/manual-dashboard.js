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

  async function fetchManualProperties(session) {
    if (!session || !supabaseUrl || !supabaseAnonKey) return [];
    const response = await fetch(`${supabaseUrl}/rest/v1/nowistay_properties?select=id,name&source=eq.manual`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return [];
    return response.json();
  }

  function applyManualLabels(manualProperties) {
    const manualIds = new Set(manualProperties.map((property) => String(property.id)));
    const manualNames = new Set(manualProperties.map((property) => String(property.name || "").trim()).filter(Boolean));

    document
      .querySelectorAll("[data-owner-intervention-form] select[name='propertyId'] option")
      .forEach((option) => {
        if (manualIds.has(String(option.value))) {
          option.dataset.source = "manual";
          if (!option.textContent.includes("(manuel)")) option.textContent = `${option.textContent} (manuel)`;
        }
      });

    document.querySelectorAll(".owner-property h2").forEach((title) => {
      const name = String(title.textContent || "").replace(" (manuel)", "").trim();
      if (manualNames.has(name) && !title.textContent.includes("(manuel)")) {
        title.textContent = `${title.textContent} (manuel)`;
      }
    });

    document.querySelectorAll(".owner-mini-stat").forEach((item) => {
      if (String(item.textContent || "").trim() === "internal_pending") {
        item.textContent = "Interne La Familia";
      }
    });
  }

  function patchManualFormFeedback(manualProperties) {
    const form = document.querySelector("[data-owner-intervention-form]");
    if (!form || form.dataset.manualFeedbackPatched === "true") return;

    const manualIds = new Set(manualProperties.map((property) => String(property.id)));
    form.dataset.manualFeedbackPatched = "true";

    form.addEventListener("submit", () => {
      const selectedPropertyId = String(new FormData(form).get("propertyId") || "");
      if (!manualIds.has(selectedPropertyId)) return;

      window.setTimeout(() => {
        const feedback = form.querySelector("[data-owner-request-feedback]");
        if (feedback && !feedback.hidden) {
          feedback.textContent = "Demande enregistrée en interne La Familia. Elle ne sera pas envoyée à Nowistay tant que ce logement n’existe pas côté Nowistay.";
        }
      }, 250);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.body.matches("[data-page='owner-dashboard']")) return;

    const manualProperties = await fetchManualProperties(getSession());
    if (!manualProperties.length) return;

    const apply = () => {
      applyManualLabels(manualProperties);
      patchManualFormFeedback(manualProperties);
    };

    apply();
    window.setTimeout(apply, 800);

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
