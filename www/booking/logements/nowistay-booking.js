(function(){
  var origin = "https://traveler.nowistay.com";
  var containers = document.querySelectorAll("[data-nowistay-id]");

  containers.forEach(function(container){
    var propertyId = container.getAttribute("data-nowistay-id");
    var propertyName = container.getAttribute("data-nowistay-name") || "La Familia";
    if (!propertyId) return;

    var iframe = document.createElement("iframe");
    iframe.src = origin + "/fr/book/" + propertyId;
    iframe.title = "Reservation Nowistay - " + propertyName;
    iframe.style.cssText = "width:100%;border:none;height:800px;max-width:100%;display:block;border-radius:20px;background:#fff;";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowtransparency", "true");

    container.style.overflow = "visible";
    container.appendChild(iframe);

    window.addEventListener("message", function(event){
      if (event.origin !== origin) return;
      if (event.data && event.data.type === "nowistay-resize" && event.data.height) {
        iframe.style.height = Math.max(event.data.height + 20, 400) + "px";
      }
    });
  });
})();
