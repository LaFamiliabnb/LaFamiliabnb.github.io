// JSON-LD for La Familia.
function addJsonLdScripts() {
  const organizationScript = document.createElement("script");
  organizationScript.type = "application/ld+json";
  organizationScript.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": "https://www.lafamiliabnb.fr/#organization",
    name: "La Familia",
    url: "https://www.lafamiliabnb.fr",
    image: "https://www.lafamiliabnb.fr/img/banniere-aix-provence.jpg",
    logo: "https://www.lafamiliabnb.fr/img/LogoLF__3_-removebg-preview.png",
    description:
      "Conciergerie Airbnb a Aix-en-Provence specialisee dans la gestion locative saisonniere pour proprietaires.",
    telephone: "+33651094966",
    email: "aurore.pageard@hotmail.fr",
    priceRange: "20% de commission",
    address: {
      "@type": "PostalAddress",
      streetAddress: "6 rue Gibelin",
      postalCode: "13100",
      addressLocality: "Aix-en-Provence",
      addressCountry: "FR",
    },
    areaServed: [
      {
        "@type": "City",
        name: "Aix-en-Provence",
      },
      {
        "@type": "AdministrativeArea",
        name: "Bouches-du-Rhone",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: "+33651094966",
      email: "aurore.pageard@hotmail.fr",
      areaServed: "FR",
      availableLanguage: ["fr", "en"],
    },
    sameAs: [
      "https://www.facebook.com/profile.php?id=61562890765862",
      "https://www.instagram.com/lafamiliabnb/?hl=fr",
    ],
  });

  const serviceScript = document.createElement("script");
  serviceScript.type = "application/ld+json";
  serviceScript.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": "https://www.lafamiliabnb.fr/#service",
    name: "Conciergerie Airbnb et gestion locative saisonniere a Aix-en-Provence",
    serviceType: "Gestion locative saisonniere",
    description:
      "Service complet de conciergerie Airbnb a Aix-en-Provence : annonces, tarification, accueil voyageurs, menage, linge et maintenance.",
    provider: {
      "@id": "https://www.lafamiliabnb.fr/#organization",
    },
    areaServed: {
      "@type": "City",
      name: "Aix-en-Provence",
    },
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "EUR",
      description:
        "20% de commission sur les revenus generes pour la gestion locative saisonniere.",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services de conciergerie",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Creation et optimisation des annonces",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Tarification dynamique",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Accueil voyageurs et check-in/check-out",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Menage, linge et maintenance",
          },
        },
      ],
    },
  });

  const websiteScript = document.createElement("script");
  websiteScript.type = "application/ld+json";
  websiteScript.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://www.lafamiliabnb.fr/#website",
    url: "https://www.lafamiliabnb.fr",
    name: "La Familia",
    description:
      "Site officiel de La Familia, conciergerie Airbnb a Aix-en-Provence pour proprietaires.",
    publisher: {
      "@id": "https://www.lafamiliabnb.fr/#organization",
    },
    inLanguage: "fr-FR",
  });

  document.head.appendChild(organizationScript);
  document.head.appendChild(serviceScript);
  document.head.appendChild(websiteScript);
}

document.addEventListener("DOMContentLoaded", addJsonLdScripts);
