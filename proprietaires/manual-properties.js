(() => {
  const SESSION_KEY = "lafamilia_owner_session";
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function showAlert(message, type = "error") {
    const alert = qs("[data-owner-alert]");
    if (!alert) return;
    alert.textContent = message;
    alert.className = `owner-alert ${type}`;
    alert.hidden = false;
  }

  function isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey);
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

  async function getOwner(session) {
    const accounts = await supabaseFetch(
      `/rest/v1/owner_accounts?select=id,auth_user_id,name,email,nowistay_owner_id&auth_user_id=eq.${session.user.id}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!accounts.length) {
      throw new Error("Aucun compte propriétaire n’est relié à cet utilisateur.");
    }

    return accounts[0];
  }

  async function loadManualProperties(session) {
    return supabaseFetch(
      "/rest/v1/nowistay_properties?select=id,name,city,country,capacity,property_type,address_line1,manual_created_at&source=eq.manual&order=name.asc",
      { accessToken: session.accessToken },
    );
  }

  function renderManualProperties(properties) {
    const list = qs("[data-manual-property-list]");
    if (!list) return;

    if (!properties.length) {
      list.innerHTML = '<div class="owner-empty">Aucun logement manuel pour le moment.</div>';
      return;
    }

    list.innerHTML = properties
      .map((property) => {
        const location = [property.address_line1, property.city, property.country].filter(Boolean).join(" · ");
        return `
          <div class="owner-report-card">
            <h3>${escapeHtml(property.name || "Logement")}</h3>
            <p class="owner-muted">${escapeHtml(location || "Adresse non renseignée")}</p>
            <div class="owner-mini-stats">
              <span class="owner-mini-stat">ID interne ${escapeHtml(property.id)}</span>
              <span class="owner-mini-stat">Manuel</span>
              ${property.capacity ? `<span class="owner-mini-stat">${escapeHtml(property.capacity)} personne(s)</span>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function init() {
    if (!document.body.matches("[data-page='owner-manual-property']")) return;

    const session = getSession();
    if (!session) {
      window.location.href = "./login.html";
      return;
    }

    let owner;
    try {
      owner = await getOwner(session);
      renderManualProperties(await loadManualProperties(session));
    } catch (error) {
      showAlert(error.message || "Impossible de charger les logements manuels.");
      return;
    }

    const form = qs("[data-manual-property-form]");
    const feedback = qs("[data-manual-property-feedback]");
    const button = qs("button[type='submit']", form);

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const city = String(formData.get("city") || "").trim();
      const country = String(formData.get("country") || "France").trim() || "France";
      const addressLine1 = String(formData.get("addressLine1") || "").trim();
      const capacityValue = String(formData.get("capacity") || "").trim();
      const capacity = capacityValue ? Number(capacityValue) : null;
      const propertyType = String(formData.get("propertyType") || "apartment");
      const manualNotes = String(formData.get("manualNotes") || "").trim();

      if (!name || !city) {
        if (feedback) {
          feedback.textContent = "Renseigne au minimum le nom du logement et la ville.";
          feedback.hidden = false;
        }
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = "Ajout…";
      }

      try {
        await supabaseFetch("/rest/v1/nowistay_properties", {
          method: "POST",
          accessToken: session.accessToken,
          prefer: "return=representation",
          body: {
            source: "manual",
            owner_id: owner.nowistay_owner_id,
            name,
            city,
            country,
            capacity,
            property_type: propertyType,
            address_line1: addressLine1 || null,
            manual_notes: manualNotes || null,
            payload: {
              source: "manual",
              manual: true,
              address: {
                line1: addressLine1 || null,
                city,
                country,
              },
            },
          },
        });

        if (feedback) {
          feedback.textContent = "Logement ajouté. Il apparaîtra dans le dashboard après actualisation.";
          feedback.hidden = false;
        }
        form.reset();
        qs("input[name='country']", form).value = "France";
        renderManualProperties(await loadManualProperties(session));
      } catch (error) {
        if (feedback) {
          feedback.textContent = error.message || "Impossible d’ajouter le logement.";
          feedback.hidden = false;
        }
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Ajouter le logement";
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
