// Votre fonction de validation existante
function validateForm() {
  // Récupérer les valeurs des champs
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const conditionsChecked = document.getElementById("conditions").checked;

  // Expressions régulières pour la validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[0-9]{10}$/;

  // Validation de l'e-mail
  if (!emailPattern.test(email)) {
    document.getElementById("emailError").textContent =
      "Veuillez entrer une adresse e-mail valide.";
    return false;
  } else {
    document.getElementById("emailError").textContent = "";
  }

  // Validation du numéro de téléphone
  if (!phonePattern.test(phone)) {
    document.getElementById("phoneError").textContent =
      "Veuillez entrer un numéro de téléphone valide (10 chiffres).";
    return false;
  } else {
    document.getElementById("phoneError").textContent = "";
  }

  // Validation de la case à cocher
  if (!conditionsChecked) {
    document.getElementById("conditionsError").textContent =
      "Vous devez accepter les conditions générales.";
    return false;
  } else {
    document.getElementById("conditionsError").textContent = "";
  }

  // Si toutes les validations passent, le formulaire peut être soumis
  return true;
}

// Ajoutez cette partie pour gérer la soumission du formulaire et déclencher l'événement de conversion
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("estimationForm");

  form.addEventListener("submit", function (e) {
    e.preventDefault(); // Empêcher la soumission normale du formulaire

    // Vérifiez d'abord si le formulaire est valide
    if (validateForm()) {
      // Appeler gtag_report_conversion pour envoyer l'événement de conversion
      gtag_report_conversion();

      // Soumettre le formulaire après un court délai pour permettre à l'événement d'être envoyé
      setTimeout(function () {
        form.submit();
      }, 500);
    }
    // Si le formulaire n'est pas valide, il ne sera pas soumis
  });
});
