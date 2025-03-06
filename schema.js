// Scripts JSON-LD pour La Familia

// Fonction pour ajouter dynamiquement les scripts JSON-LD au document
function addJsonLdScripts() {
  // Script pour l'organisation
  const organizationScript = document.createElement("script");
  organizationScript.type = "application/ld+json";
  organizationScript.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateAgency",
    name: "La Familia",
    description:
      "Conciergerie spécialisée dans la gestion de locations saisonnières à Aix-en-Provence. Nous optimisons vos revenus locatifs et offrons une expérience unique à vos voyageurs.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "50 Cours Mirabeau",
      addressLocality: "Aix-en-Provence",
      postalCode: "13100",
      addressCountry: "FR",
    },
    telephone: "+33651094966",
    email: "aurore.pageard@hotmail.com",
    url: "https://lafamiliabnb.fr",
    logo: "https://lafamiliabnb.fr/img/LogoLF__3_-removebg-preview.png",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+33651094966",
      contactType: "Customer Service",
      availableLanguage: ["French", "English"],
    },
    serviceArea: {
      "@type": "Place",
      name: "Aix-en-Provence et ses environs",
    },
    areaServed: "Aix-en-Provence",
    founder: {
      "@type": "Person",
      name: "Aurore Pageard",
    },
  });

  // Script pour les services de location saisonnière
  const servicesScript = document.createElement("script");
  servicesScript.type = "application/ld+json";
  servicesScript.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Gestion de Location Saisonnière La Familia",
    description:
      "Service complet de gestion de locations saisonnières à Aix-en-Provence. Optimisation des revenus, accueil des voyageurs, maintenance et entretien.",
    provider: {
      "@type": "RealEstateAgency",
      name: "La Familia",
    },
    serviceType: "Location saisonnière",
    areaServed: "Aix-en-Provence",
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "EUR",
      description: "20% de commission sur les revenus générés",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services de Conciergerie",
      itemListElement: [
        {
          "@type": "Offer",
          name: "Gestion complète des locations",
        },
        {
          "@type": "Offer",
          name: "Optimisation des prix",
        },
        {
          "@type": "Offer",
          name: "Accueil des voyageurs",
        },
        {
          "@type": "Offer",
          name: "Maintenance et nettoyage",
        },
      ],
    },
  });

  // Script pour le site web
  const websiteScript = document.createElement("script");
  websiteScript.type = "application/ld+json";
  websiteScript.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "La Familia - Conciergerie Locations Saisonnières",
    url: "https://lafamiliabnb.fr",
    description:
      "Conciergerie à Aix-en-Provence spécialisée dans la gestion de locations saisonnières. Optimisez vos revenus locatifs avec nos services professionnels.",
    publisher: {
      "@type": "Organization",
      name: "La Familia",
      logo: "https://lafamiliabnb.fr/img/LogoLF__3_-removebg-preview.png",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: "https://lafamiliabnb.fr/estimation.html",
      "query-input": "required name=search_term_string",
    },
  });

  // Ajout des scripts au document
  document.head.appendChild(organizationScript);
  document.head.appendChild(servicesScript);
  document.head.appendChild(websiteScript);
}

// Exécution de la fonction lors du chargement du document
document.addEventListener("DOMContentLoaded", addJsonLdScripts);
