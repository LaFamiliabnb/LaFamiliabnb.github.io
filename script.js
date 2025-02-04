document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const menuList = document.getElementById("menu");

  if (hamburger && menuList) {
    hamburger.addEventListener("click", () => {
      menuList.classList.toggle("active");
      hamburger.classList.toggle("active");
    });
  } else {
    console.error("Hamburger or menuList not found");
  }
});
