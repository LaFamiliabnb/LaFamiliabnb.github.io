(() => {
  const STATUS_MAP = new Map([
    ["pending_admin", { label: "Attente confirmation", style: "background:#fff3cd;color:#8a5a00;border-color:#f6c343;" }],
    ["pending_sync", { label: "Attente confirmation", style: "background:#fff3cd;color:#8a5a00;border-color:#f6c343;" }],
    ["internal_pending", { label: "Attente confirmation", style: "background:#fff3cd;color:#8a5a00;border-color:#f6c343;" }],
    ["Demande envoyée", { label: "Attente confirmation", style: "background:#fff3cd;color:#8a5a00;border-color:#f6c343;" }],
    ["Interne La Familia", { label: "Attente confirmation", style: "background:#fff3cd;color:#8a5a00;border-color:#f6c343;" }],
    ["approved", { label: "Validé", style: "background:#d1fae5;color:#065f46;border-color:#34d399;" }],
    ["synced", { label: "Validé", style: "background:#d1fae5;color:#065f46;border-color:#34d399;" }],
    ["Synchronisée", { label: "Validé", style: "background:#d1fae5;color:#065f46;border-color:#34d399;" }],
    ["Synchronisée Nowistay", { label: "Validé", style: "background:#d1fae5;color:#065f46;border-color:#34d399;" }],
    ["rejected", { label: "Refusé", style: "background:#fee2e2;color:#991b1b;border-color:#f87171;" }],
  ]);

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function decorateStatusBadge(element) {
    const original = normalize(element.textContent);
    const status = STATUS_MAP.get(original);
    if (!status) return;

    element.textContent = status.label;
    element.setAttribute("style", status.style);
    element.dataset.ownerRequestStatusDecorated = "true";
  }

  function updateRequestFeedback() {
    document.querySelectorAll("[data-owner-request-feedback]").forEach((element) => {
      const text = normalize(element.textContent);
      if (!text || !/synchron/i.test(text)) return;
      element.textContent = "Demande enregistrée. Elle est en attente de confirmation par La Familia.";
    });
  }

  function apply() {
    document.querySelectorAll(".owner-mini-stat").forEach(decorateStatusBadge);
    updateRequestFeedback();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.matches("[data-page='owner-dashboard']")) return;
    apply();
    window.setTimeout(apply, 800);
    window.setTimeout(apply, 1600);

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
