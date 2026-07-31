const LA_FAMILIA_MAPS_URL = "https://maps.app.goo.gl/iJCxQQ3ByhTFWyVd8";
const ESTIMATION_FORM_EVENT = "form_submission_success";

// Bloc de contact direct affiché sur la page Estimer mes revenus
function insertEstimationContactBlock() {
  const form = document.getElementById("estimationForm");
  if (!form) return;

  const heroLeft = document.querySelector(".hero > div:first-child");
  const formIntro = document.querySelector(".form-card .form-intro");

  const contactHtml = `
    <div class="estimation-contact-highlight" style="margin-top:24px;display:grid;gap:12px;background:#fff3e8;border:1px solid rgba(0,0,0,.08);border-radius:20px;padding:22px;box-shadow:0 8px 24px rgba(0,0,0,.08);">
      <strong style="display:block;color:#202020;font-size:1.08rem;">Besoin d’un échange rapide ?</strong>
      <a href="tel:+33651094966" style="display:flex;align-items:center;gap:10px;color:#202020;text-decoration:none;font-weight:900;">
        <i class="fas fa-phone" aria-hidden="true" style="color:#b86b3d;"></i>
        <span>06 51 09 49 66</span>
      </a>
      <a href="${LA_FAMILIA_MAPS_URL}" target="_blank" rel="noopener" style="display:flex;align-items:flex-start;gap:10px;color:#202020;text-decoration:none;font-weight:900;">
        <i class="fas fa-map-marker-alt" aria-hidden="true" style="color:#b86b3d;margin-top:4px;"></i>
        <span>6 rue Gibelin<br>13100 Aix-en-Provence</span>
      </a>
      <small style="color:#5f5f5f;line-height:1.5;">Vous pouvez aussi remplir le formulaire : nous vous recontactons pour affiner l’estimation de votre logement.</small>
    </div>
  `;

  if (heroLeft && !document.querySelector(".hero .estimation-contact-highlight")) {
    const microProof = heroLeft.querySelector(".micro-proof");
    if (microProof) {
      microProof.insertAdjacentHTML("afterend", contactHtml);
    } else {
      heroLeft.insertAdjacentHTML("beforeend", contactHtml);
    }
  }

  if (formIntro && !document.querySelector(".form-card .estimation-mini-contact")) {
    formIntro.insertAdjacentHTML(
      "afterend",
      `<div class="estimation-mini-contact" style="margin:0 0 22px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <a href="tel:+33651094966" style="background:#202020;color:#fffaf4;text-decoration:none;border-radius:14px;padding:13px 15px;font-weight:900;text-align:center;">Appeler</a>
        <a href="${LA_FAMILIA_MAPS_URL}" target="_blank" rel="noopener" style="background:#fbe0c3;color:#202020;text-decoration:none;border-radius:14px;padding:13px 15px;font-weight:900;text-align:center;">Nous situer</a>
      </div>`
    );
  }
}

// Remplace tous les anciens liens Google Maps par la fiche Google officielle
function updateMapsLinks() {
  document.querySelectorAll('a[href*="google.com/maps"], a[href*="maps.app.goo.gl"]').forEach((link) => {
    const label = link.textContent.toLowerCase();
    const isAddressLink = link.textContent.includes("6 rue Gibelin") || label.includes("nous situer");
    if (isAddressLink) {
      link.href = LA_FAMILIA_MAPS_URL;
      link.target = "_blank";
      link.rel = "noopener";
    }
  });
}

// Améliore la lisibilité du tableau de revenus sur fond noir
function improveRevenueTableReadability() {
  const style = document.createElement("style");
  style.textContent = `
    .section.dark .revenue-table tbody td {
      color: #b86b3d !important;
      font-weight: 800;
      background: #fffaf4 !important;
    }

    .section.dark .revenue-table tbody td strong {
      color: #b86b3d !important;
      font-weight: 900;
    }

    .section.dark .revenue-table tbody tr:nth-child(even) td {
      background: #fff3e8 !important;
    }

    .section.dark .revenue-table thead th {
      color: #fffaf4 !important;
      background: #202020 !important;
    }
  `;
  document.head.appendChild(style);
}

function normalizeFrenchPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("0033") && digits.length === 13) {
    return `0${digits.slice(4)}`;
  }

  if (digits.startsWith("33") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

function preparePhoneField() {
  const phoneInput = document.getElementById("phone");
  if (!phoneInput) return;

  // Le pattern HTML initial bloquait les numéros contenant des espaces avant même
  // l’exécution du JavaScript. La validation est désormais centralisée ci-dessous.
  phoneInput.removeAttribute("pattern");
  phoneInput.setAttribute("inputmode", "tel");

  phoneInput.addEventListener("blur", () => {
    const normalizedPhone = normalizeFrenchPhone(phoneInput.value);
    if (/^0[1-9]\d{8}$/.test(normalizedPhone)) {
      phoneInput.value = normalizedPhone.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    }
  });
}

function getOrCreateFormStatus(form) {
  let status = form.querySelector(".form-status");
  if (status) return status;

  status = document.createElement("p");
  status.className = "form-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.margin = "16px 0 0";
  status.style.padding = "14px 16px";
  status.style.borderRadius = "14px";
  status.style.display = "none";

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) {
    submitButton.insertAdjacentElement("afterend", status);
  } else {
    form.appendChild(status);
  }

  return status;
}

function showFormStatus(status, type, message) {
  status.textContent = message;
  status.style.display = "block";
  status.style.background = type === "success" ? "#edf7ed" : "#fff0ed";
  status.style.border = type === "success" ? "1px solid #9bc79b" : "1px solid #d79a8d";
  status.style.color = type === "success" ? "#245c2a" : "#8b2f20";
}

// Validation du formulaire avec prise en charge des formats 06 00 00 00 00 et +33 6 00 00 00 00.
function validateForm() {
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const conditionsInput = document.getElementById("conditions");

  if (!emailInput || !phoneInput || !conditionsInput) return false;

  const email = emailInput.value.trim();
  const normalizedPhone = normalizeFrenchPhone(phoneInput.value);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^0[1-9]\d{8}$/;

  let valid = true;

  if (!emailPattern.test(email)) {
    document.getElementById("emailError").textContent =
      "Veuillez entrer une adresse e-mail valide.";
    valid = false;
  } else {
    document.getElementById("emailError").textContent = "";
    emailInput.value = email;
  }

  if (!phonePattern.test(normalizedPhone)) {
    document.getElementById("phoneError").textContent =
      "Veuillez entrer un numéro français valide, par exemple 06 00 00 00 00.";
    valid = false;
  } else {
    document.getElementById("phoneError").textContent = "";
    phoneInput.value = normalizedPhone;
  }

  if (!conditionsInput.checked) {
    document.getElementById("conditionsError").textContent =
      "Vous devez accepter d’être recontacté au sujet de votre estimation.";
    valid = false;
  } else {
    document.getElementById("conditionsError").textContent = "";
  }

  return valid;
}

function pushFormEvent(eventName, extraData = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    form_name: "estimation_revenus",
    ...extraData,
  });
}

function trackSuccessfulSubmission() {
  // Événement destiné à GTM : il doit déclencher la balise de conversion Google Ads.
  pushFormEvent(ESTIMATION_FORM_EVENT);

  // Événement GA4 standard utile pour l’analyse des prospects.
  if (typeof window.gtag === "function") {
    window.gtag("event", "generate_lead", {
      form_name: "estimation_revenus",
    });
  }
}

async function submitFormToFormspree(form) {
  const response = await fetch(form.action, {
    method: (form.method || "POST").toUpperCase(),
    body: new FormData(form),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorMessage = "Le formulaire n’a pas pu être envoyé.";

    try {
      const payload = await response.json();
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        errorMessage = payload.errors.map((error) => error.message).join(" ");
      }
    } catch (error) {
      // La réponse n’est pas nécessairement au format JSON.
    }

    throw new Error(errorMessage);
  }
}

// Gestion de la soumission du formulaire
document.addEventListener("DOMContentLoaded", function () {
  insertEstimationContactBlock();
  updateMapsLinks();
  improveRevenueTableReadability();
  preparePhoneField();

  const form = document.getElementById("estimationForm");
  if (!form) return;

  const status = getOrCreateFormStatus(form);
  const submitButton = form.querySelector('[type="submit"]');
  const initialButtonContent = submitButton ? submitButton.innerHTML : "";

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    status.style.display = "none";

    if (!validateForm()) return;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.textContent = "Envoi en cours…";
    }

    try {
      await submitFormToFormspree(form);
      trackSuccessfulSubmission();
      form.reset();
      showFormStatus(
        status,
        "success",
        "Merci, votre demande a bien été envoyée. La Familia vous recontactera rapidement."
      );
    } catch (error) {
      console.error("Erreur d’envoi du formulaire d’estimation :", error);
      pushFormEvent("form_submission_error");
      showFormStatus(
        status,
        "error",
        "L’envoi a échoué. Merci de réessayer ou de nous appeler au 06 51 09 49 66."
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.innerHTML = initialButtonContent;
      }
    }
  });
});
