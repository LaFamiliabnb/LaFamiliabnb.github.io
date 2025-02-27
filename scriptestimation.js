<script>
function validateForm() {
  // Récupérer les valeurs des champs
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const conditionsChecked = document.getElementById('conditions').checked;

  // Expressions régulières pour la validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[0-9]{10}$/;

  // Validation de l'e-mail
  if (!emailPattern.test(email)) {
    document.getElementById('emailError').textContent = "Veuillez entrer une adresse e-mail valide.";
    return false;
  } else {
    document.getElementById('emailError').textContent = "";
  }

  // Validation du numéro de téléphone
  if (!phonePattern.test(phone)) {
    document.getElementById('phoneError').textContent = "Veuillez entrer un numéro de téléphone valide (10 chiffres).";
    return false;
  } else {
    document.getElementById('phoneError').textContent = "";
  }

  // Validation de la case à cocher
  if (!conditionsChecked) {
    document.getElementById('conditionsError').textContent = "Vous devez accepter les conditions générales.";
    return false;
  } else {
    document.getElementById('conditionsError').textContent = "";
  }

  // Si toutes les validations passent, le formulaire peut être soumis
  return true;
}