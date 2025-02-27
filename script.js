document.addEventListener("DOMContentLoaded", function () {
  const hamburger = document.querySelector(".hamburger");
  const menuList = document.querySelector(".menu-list");

  hamburger.addEventListener("click", function () {
    hamburger.classList.toggle("active");
    menuList.classList.toggle("active");
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    question.addEventListener("click", function () {
      if (answer.classList.contains("active")) {
        answer.classList.remove("active");
        question.classList.remove("active");
      } else {
        // Fermer toutes les autres réponses
        faqItems.forEach((otherItem) => {
          const otherAnswer = otherItem.querySelector(".faq-answer");
          const otherQuestion = otherItem.querySelector(".faq-question");
          if (
            otherAnswer !== answer &&
            otherAnswer.classList.contains("active")
          ) {
            otherAnswer.classList.remove("active");
            otherQuestion.classList.remove("active");
          }
        });
        // Ouvrir la réponse cliquée
        answer.classList.add("active");
        question.classList.add("active");
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const serviceTitles = document.querySelectorAll(".service-title");

  serviceTitles.forEach((title) => {
    title.addEventListener("click", function () {
      const serviceList = title.nextElementSibling;
      if (serviceList.classList.contains("active")) {
        serviceList.classList.remove("active");
        title.classList.remove("active");
      } else {
        // Fermer toutes les autres listes
        serviceTitles.forEach((otherTitle) => {
          const otherList = otherTitle.nextElementSibling;
          if (
            otherList !== serviceList &&
            otherList.classList.contains("active")
          ) {
            otherList.classList.remove("active");
            otherTitle.classList.remove("active");
          }
        });
        // Ouvrir la liste cliquée
        serviceList.classList.add("active");
        title.classList.add("active");
      }
    });
  });
});
