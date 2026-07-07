(() => {
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const defaultBucket = "cleaning-reports";

  function encodeStoragePath(path) {
    return String(path || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function toStoragePublicUrl(value) {
    if (!supabaseUrl || !value) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (!value.startsWith("missions/")) return value;
    return `${supabaseUrl}/storage/v1/object/public/${defaultBucket}/${encodeStoragePath(value)}`;
  }

  function fixPhotoUrls() {
    document.querySelectorAll("[data-report-gallery] img").forEach((img) => {
      const fixed = toStoragePublicUrl(img.getAttribute("src"));
      if (fixed && fixed !== img.getAttribute("src")) {
        img.setAttribute("src", fixed);
      }
    });

    document.querySelectorAll("[data-report-gallery] a").forEach((link) => {
      const fixed = toStoragePublicUrl(link.getAttribute("href"));
      if (fixed && fixed !== link.getAttribute("href")) {
        link.setAttribute("href", fixed);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    fixPhotoUrls();

    const gallery = document.querySelector("[data-report-gallery]");
    if (!gallery) return;

    const observer = new MutationObserver(fixPhotoUrls);
    observer.observe(gallery, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href"] });
  });
})();
