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
  const form = document.getElementById("estimationForm");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (validateForm()) {
      sendConversionEvent(() => {
        form.submit();
      });
    }
  });
});
