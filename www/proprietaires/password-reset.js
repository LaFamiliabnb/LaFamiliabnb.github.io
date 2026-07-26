(() => {
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";
  const context = document.body.dataset.passwordContext || "owner";
  const loginPath = context === "admin" ? "./login.html" : "./index.html";

  function isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("ton-projet") && !supabaseAnonKey.includes("ta_anon_key"));
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function showAlert(message, type = "error") {
    const alert = qs("[data-password-alert]");
    if (!alert) return;
    alert.textContent = message;
    alert.className = `owner-alert ${type}`;
    alert.hidden = false;
  }

  async function supabaseFetch(path, options = {}) {
    if (!isConfigured()) {
      throw new Error("Supabase n’est pas configuré. Vérifie le fichier config.js.");
    }

    const response = await fetch(`${supabaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${options.accessToken || supabaseAnonKey}`,
        "Content-Type": "application/json",
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

  function recoveryRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function recoveryTokenFromUrl() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("access_token") || query.get("access_token") || "";
  }

  async function sendRecoveryEmail(email) {
    const redirectTo = encodeURIComponent(recoveryRedirectUrl());
    return supabaseFetch(`/auth/v1/recover?redirect_to=${redirectTo}`, {
      method: "POST",
      body: {
        email,
        gotrue_meta_security: {},
      },
    });
  }

  async function updatePassword(accessToken, password) {
    return supabaseFetch("/auth/v1/user", {
      method: "PUT",
      accessToken,
      body: { password },
    });
  }

  function showResetMode() {
    qs("[data-password-request-panel]")?.setAttribute("hidden", "");
    qs("[data-password-reset-panel]")?.removeAttribute("hidden");
  }

  function init() {
    const token = recoveryTokenFromUrl();
    const requestForm = qs("[data-password-request-form]");
    const resetForm = qs("[data-password-reset-form]");
    const requestButton = qs("[data-password-request-button]");
    const resetButton = qs("[data-password-reset-button]");

    if (!isConfigured()) {
      showAlert("Supabase n’est pas configuré.");
      if (requestButton) requestButton.disabled = true;
      if (resetButton) resetButton.disabled = true;
      return;
    }

    if (token) {
      showResetMode();
    }

    requestForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = qs("[data-password-email]", requestForm)?.value.trim();
      if (!email) {
        showAlert("Renseigne ton email.");
        return;
      }

      if (requestButton) {
        requestButton.disabled = true;
        requestButton.textContent = "Envoi…";
      }

      try {
        await sendRecoveryEmail(email);
        showAlert("Si ce compte existe, un email de réinitialisation vient d’être envoyé.", "success");
        requestForm.reset();
      } catch (error) {
        showAlert(error.message || "Impossible d’envoyer l’email de réinitialisation.");
      } finally {
        if (requestButton) {
          requestButton.disabled = false;
          requestButton.textContent = "Recevoir le lien";
        }
      }
    });

    resetForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = qs("[data-new-password]", resetForm)?.value || "";
      const confirmation = qs("[data-confirm-password]", resetForm)?.value || "";

      if (password.length < 8) {
        showAlert("Le nouveau mot de passe doit contenir au moins 8 caractères.");
        return;
      }

      if (password !== confirmation) {
        showAlert("Les deux mots de passe ne correspondent pas.");
        return;
      }

      if (!token) {
        showAlert("Lien de réinitialisation invalide ou expiré. Redemande un nouveau lien.");
        return;
      }

      if (resetButton) {
        resetButton.disabled = true;
        resetButton.textContent = "Mise à jour…";
      }

      try {
        await updatePassword(token, password);
        window.history.replaceState({}, document.title, window.location.pathname);
        showAlert("Mot de passe mis à jour. Tu peux maintenant te connecter.", "success");
        resetForm.reset();
        window.setTimeout(() => {
          window.location.href = loginPath;
        }, 1200);
      } catch (error) {
        showAlert(error.message || "Impossible de modifier le mot de passe.");
      } finally {
        if (resetButton) {
          resetButton.disabled = false;
          resetButton.textContent = "Changer le mot de passe";
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
