(() => {
  const CLEANER_LABEL = "Intervenant(e)";

  function firstNameOnly(value) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    if (!clean || clean.toLowerCase() === "non renseigné") return clean || "Non renseigné";
    return clean.split(" ")[0];
  }

  function sanitizeText(value) {
    let text = String(value || "");

    text = text.replace(/date d’intervention,\s*cleaner,/gi, "date d’intervention, intervenant(e),");
    text = text.replace(/\s*·\s*Nowistay\s*#\d+/gi, "");
    text = text.replace(/Nowistay mission\s*#\d+/gi, "Rapport ménage");
    text = text.replace(/Mission Nowistay/gi, "Rapport ménage");
    text = text.replace(/logements Nowistay/gi, "logements");
    text = text.replace(/propriétaire Nowistay/gi, "propriétaire");
    text = text.replace(/Nowistay\s*#\d+/gi, "");
    text = text.replace(/Nowistay/gi, "");

    text = text.replace(/Cleaner\s*:/gi, `${CLEANER_LABEL} :`);
    text = text.replace(/\bCleaner\b/gi, CLEANER_LABEL);

    return text.replace(/\s{2,}/g, " ").trim();
  }

  function sanitizeCleanerElements() {
    document.querySelectorAll("[data-report-cleaner]").forEach((element) => {
      element.textContent = firstNameOnly(element.textContent);
    });

    document.querySelectorAll(".owner-report-card .owner-muted").forEach((element) => {
      element.textContent = element.textContent.replace(/Cleaner\s*:\s*([^·\n]+)/gi, (_match, name) => {
        return `${CLEANER_LABEL} : ${firstNameOnly(name)}`;
      });
    });
  }

  function sanitizeTextNodes(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
      const next = sanitizeText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function applyPrivacyRules() {
    sanitizeTextNodes();
    sanitizeCleanerElements();
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyPrivacyRules();

    const observer = new MutationObserver(() => applyPrivacyRules());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
})();
