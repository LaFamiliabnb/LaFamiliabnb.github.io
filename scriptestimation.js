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
      <a href="https://www.google.com/maps/search/?api=1&query=6%20rue%20Gibelin%2013100%20Aix-en-Provence" target="_blank" rel="noopener" style="display:flex;align-items:flex-start;gap:10px;color:#202020;text-decoration:none;font-weight:900;">
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
        <a href="https://www.google.com/maps/search/?api=1&query=6%20rue%20Gibelin%2013100%20Aix-en-Provence" target="_blank" rel="noopener" style="background:#fbe0c3;color:#202020;text-decoration:none;border-radius:14px;padding:13px 15px;font-weight:900;text-align:center;">Nous situer</a>
      </div>`
    );
  }
}

// Fonction de validation
function validateForm() {
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const conditionsChecked = document.getElementById("conditions").checked;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[0-9]{10}$/;

  let valid = true;

  // Validation de l'e-mail
  if (!emailPattern.test(email)) {
    document.getElementById("emailError").textContent =
      "Veuillez entrer une adresse e-mail valide.";
    valid = false;
  } else {
    document.getElementById("emailError").textContent = "";
  }

  // Validation du téléphone
  if (!phonePattern.test(phone)) {
    document.getElementById("phoneError").textContent =
      "Veuillez entrer un numéro de téléphone valide (10 chiffres).";
    valid = false;
  } else {
    document.getElementById("phoneError").textContent = "";
  }

  // Validation des conditions
  if (!conditionsChecked) {
    document.getElementById("conditionsError").textContent =
      "Vous devez accepter les conditions générales.";
    valid = false;
  } else {
    document.getElementById("conditionsError").textContent = "";
  }

  return valid;
}

// Fonction d’envoi de l’événement Google
function sendConversionEvent(callback) {
  if (typeof gtag === "function") {
    gtag("event", "conversion_event_contact", {
      event_callback: callback,
      event_timeout: 2000,
    });
  } else {
    // Si gtag n’est pas encore chargé, on appelle quand même le callback
    callback();
  }
}

// Gestion de la soumission du formulaire
document.addEventListener("DOMContentLoaded", function () {
  insertEstimationContactBlock();

  const form = document.getElementById("estimationForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (validateForm()) {
      sendConversionEvent(() => {
        form.submit();
      });
    }
  });
});
