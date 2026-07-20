(() => {
  const SESSION_KEY = "lafamilia_owner_session";
  const config = window.LA_FAMILIA_SUPABASE_CONFIG || {};
  const supabaseUrl = (config.url || "").replace(/\/$/, "");
  const supabaseAnonKey = config.anonKey || "";

  function isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("ton-projet") && !supabaseAnonKey.includes("ta_anon_key"));
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  async function supabaseFetch(path, options = {}) {
    if (!isConfigured()) throw new Error("Supabase n’est pas configuré.");

    const response = await fetch(`${supabaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${options.accessToken || supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const payload = contentType.includes("application/json") && raw ? JSON.parse(raw) : raw;

    if (!response.ok) {
      const message = payload && typeof payload === "object" && payload.message ? payload.message : "Erreur Supabase";
      throw new Error(message);
    }

    return payload;
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(numberValue(value) * factor) / factor;
  }

  function formatMoney(value, currency = "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(numberValue(value));
  }

  function formatMoneyPrecise(value, currency = "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numberValue(value));
  }

  function formatPercent(value) {
    return new Intl.NumberFormat("fr-FR", {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(numberValue(value));
  }

  function formatMonth(value) {
    if (!value) return "Période";
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
  }

  function periodKey(row) {
    return row.month_start || `${row.year}-${String(row.month).padStart(2, "0")}-01`;
  }

  function buildPeriods(financials) {
    return Array.from(new Set(financials.map(periodKey).filter(Boolean))).sort((a, b) => new Date(b) - new Date(a));
  }

  function defaultPeriod(periods) {
    const current = new Date();
    const currentKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
    return periods.includes(currentKey) ? currentKey : periods[0] || "";
  }

  function sumRows(rows) {
    const total = rows.reduce(
      (acc, row) => {
        const currency = row.currency || acc.currency || "EUR";
        acc.currency = currency;
        acc.grossRevenue += numberValue(row.gross_revenue);
        acc.cleaningFees += numberValue(row.cleaning_fees);
        acc.taxes += numberValue(row.taxes);
        acc.otaCommission += numberValue(row.ota_commission);
        acc.netBeforeLafamilia += numberValue(row.net_before_lafamilia);
        acc.laFamiliaCommission += numberValue(row.la_familia_commission);
        acc.ownerPayout += numberValue(row.owner_payout_estimated);
        acc.reservedNights += numberValue(row.reserved_nights);
        acc.availableNights += numberValue(row.available_nights);
        acc.confirmedStays += numberValue(row.confirmed_stays);
        return acc;
      },
      {
        currency: "EUR",
        grossRevenue: 0,
        cleaningFees: 0,
        taxes: 0,
        otaCommission: 0,
        netBeforeLafamilia: 0,
        laFamiliaCommission: 0,
        ownerPayout: 0,
        reservedNights: 0,
        availableNights: 0,
        confirmedStays: 0,
      },
    );

    total.lodgingRevenue = total.grossRevenue - total.cleaningFees - total.taxes;
    total.averageNightlyRate = total.reservedNights ? total.lodgingRevenue / total.reservedNights : 0;
    total.revparGross = total.availableNights ? total.lodgingRevenue / total.availableNights : 0;
    total.revparNet = total.availableNights ? total.netBeforeLafamilia / total.availableNights : 0;
    total.ownerRevpar = total.availableNights ? total.ownerPayout / total.availableNights : 0;
    total.occupancyRate = total.availableNights ? total.reservedNights / total.availableNights : 0;
    total.averageStay = total.confirmedStays ? total.reservedNights / total.confirmedStays : 0;
    return total;
  }

  function sourceTotals(rows) {
    const totals = new Map();
    rows.forEach((row) => {
      const breakdown = typeof row.source_breakdown === "object" && row.source_breakdown ? row.source_breakdown : {};
      Object.entries(breakdown).forEach(([source, values]) => {
        const current = totals.get(source) || { source, grossRevenue: 0, reservedNights: 0 };
        current.grossRevenue += numberValue(values?.grossRevenue);
        current.reservedNights += numberValue(values?.reservedNights);
        totals.set(source, current);
      });
    });
    return Array.from(totals.values()).sort((a, b) => b.grossRevenue - a.grossRevenue);
  }

  function financeLine(label, value, currency, className = "") {
    return `
      <div class="owner-finance-line ${className}">
        <span>${escapeHtml(label)}</span>
        <strong>${formatMoneyPrecise(value, currency)}</strong>
      </div>
    `;
  }

  function metricCard(label, value, helper = "") {
    return `
      <div class="owner-finance-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        ${helper ? `<small>${escapeHtml(helper)}</small>` : ""}
      </div>
    `;
  }

  function propertyFinanceCard(row) {
    const currency = row.currency || "EUR";
    const payout = numberValue(row.owner_payout_estimated);
    const netBefore = numberValue(row.net_before_lafamilia);
    const commission = numberValue(row.la_familia_commission);
    const occupancy = numberValue(row.occupancy_rate);
    const sourceRows = sourceTotals([row]);
    const mainSource = sourceRows[0];

    return `
      <article class="owner-finance-property-card">
        <div class="owner-finance-property-head">
          <div>
            <span class="owner-eyebrow">Logement</span>
            <h3>${escapeHtml(row.property_name || "Logement")}</h3>
          </div>
          <strong>${formatMoney(payout, currency)}</strong>
        </div>
        <div class="owner-finance-mini-grid">
          ${metricCard("CA", formatMoney(numberValue(row.gross_revenue), currency))}
          ${metricCard("Restant avant La Familia", formatMoney(netBefore, currency))}
          ${metricCard("Commission La Familia", formatMoney(commission, currency), "20 % du restant")}
          ${metricCard("Occupation", formatPercent(occupancy), `${numberValue(row.reserved_nights)} nuit(s)`)}
        </div>
        <div class="owner-finance-source-row">
          <div class="owner-finance-donut" style="--finance-share:${Math.min(100, Math.max(0, round(numberValue(mainSource?.grossRevenue) / Math.max(numberValue(row.gross_revenue), 1) * 100, 1)))}"></div>
          <div>
            <strong>${escapeHtml(mainSource?.source ? mainSource.source.toUpperCase() : "Sources")}</strong>
            <p class="owner-muted">${mainSource ? `${mainSource.reservedNights} nuit(s) · ${formatMoney(mainSource.grossRevenue, currency)}` : "Aucune source détaillée"}</p>
          </div>
        </div>
      </article>
    `;
  }

  function financeHtml(financials, selectedPeriod) {
    const rows = financials.filter((row) => periodKey(row) === selectedPeriod);
    const periods = buildPeriods(financials);

    if (!financials.length) {
      return `
        <section class="owner-section owner-finance-section" data-owner-finance-section>
          <div class="owner-finance-premium-head">
            <div>
              <p class="owner-eyebrow">Finances</p>
              <h2>Mes finances</h2>
              <p class="owner-muted">Le module est prêt. Les données apparaîtront ici dès la prochaine synchronisation financière.</p>
            </div>
          </div>
          <div class="owner-empty">Aucune donnée financière synchronisée pour le moment.</div>
        </section>
      `;
    }

    const total = sumRows(rows);
    const currency = total.currency;
    const sourceRows = sourceTotals(rows);
    const sourceTotal = sourceRows.reduce((sum, source) => sum + source.grossRevenue, 0) || 1;

    const sourceHtml = sourceRows.length
      ? sourceRows
          .map((source) => `
            <div class="owner-finance-source-line">
              <span>${escapeHtml(source.source.toUpperCase())}</span>
              <strong>${formatPercent(source.grossRevenue / sourceTotal)} · ${formatMoney(source.grossRevenue, currency)}</strong>
            </div>
          `)
          .join("")
      : '<div class="owner-empty">Aucune source détaillée.</div>';

    return `
      <section class="owner-section owner-finance-section" data-owner-finance-section>
        <div class="owner-finance-premium-head">
          <div>
            <p class="owner-eyebrow">Finances</p>
            <h2>Mes finances</h2>
            <p class="owner-muted">Vue propriétaire nette, avec la commission La Familia de 20 % déduite du restant.</p>
          </div>
          <label class="owner-label owner-finance-period-label">
            Période
            <select class="owner-input" data-owner-finance-period>
              ${periods.map((period) => `<option value="${escapeHtml(period)}"${period === selectedPeriod ? " selected" : ""}>${formatMonth(period)}</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="owner-finance-hero">
          <div class="owner-finance-hero-main">
            <span>Versement estimé propriétaire</span>
            <strong>${formatMoney(total.ownerPayout, currency)}</strong>
            <p>Après frais ménage, taxes, commission OTA et commission La Familia.</p>
          </div>
          <div class="owner-finance-waterfall">
            ${financeLine("Chiffre d’affaires", total.grossRevenue, currency)}
            ${financeLine("- Frais de ménage", -total.cleaningFees, currency)}
            ${financeLine("- Taxes", -total.taxes, currency)}
            ${financeLine("- Commission OTA", -total.otaCommission, currency)}
            ${financeLine("Restant avant La Familia", total.netBeforeLafamilia, currency, "is-subtotal")}
            ${financeLine("- Commission La Familia 20 %", -total.laFamiliaCommission, currency, "is-commission")}
            ${financeLine("Net propriétaire estimé", total.ownerPayout, currency, "is-total")}
          </div>
        </div>

        <div class="owner-finance-metrics-grid">
          ${metricCard("Prix moyen par nuit", formatMoney(total.averageNightlyRate, currency), "Hébergement hors frais et taxes")}
          ${metricCard("RevPAR brut", formatMoney(total.revparGross, currency), "Hébergement / nuits disponibles")}
          ${metricCard("RevPAR net", formatMoney(total.revparNet, currency), "Restant avant La Familia / nuits disponibles")}
          ${metricCard("RevPAR propriétaire", formatMoney(total.ownerRevpar, currency), "Net propriétaire / nuits disponibles")}
          ${metricCard("Occupation", formatPercent(total.occupancyRate), `${total.reservedNights} nuit(s) réservée(s)`)}
          ${metricCard("Séjours confirmés", String(total.confirmedStays), `Durée moyenne ${round(total.averageStay, 1).toString().replace(".", ",")} nuit(s)`)}
        </div>

        <div class="owner-finance-details-grid">
          <div class="owner-finance-panel">
            <h3>Répartition par source</h3>
            ${sourceHtml}
          </div>
          <div class="owner-finance-panel">
            <h3>Détail par logement</h3>
            <div class="owner-finance-property-list">
              ${rows.map(propertyFinanceCard).join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async function loadFinance(session) {
    const accounts = await supabaseFetch(
      `/rest/v1/owner_accounts?select=id,auth_user_id,name,email,nowistay_owner_id&auth_user_id=eq.${session.user.id}&limit=1`,
      { accessToken: session.accessToken },
    );

    if (!accounts.length) return [];
    const ownerId = accounts[0].nowistay_owner_id;

    return supabaseFetch(
      `/rest/v1/owner_financial_monthly?select=property_id,property_name,owner_id,month_start,year,month,currency,gross_revenue,cleaning_fees,taxes,ota_commission,net_before_lafamilia,la_familia_commission_rate,la_familia_commission,owner_payout_estimated,average_nightly_rate,revpar_net,revpar_gross,occupancy_rate,reserved_nights,available_nights,confirmed_stays,average_stay,source_breakdown,synced_at&owner_id=eq.${ownerId}&order=month_start.desc,property_name.asc&limit=500`,
      { accessToken: session.accessToken },
    );
  }

  function insertFinanceSection(financials, selectedPeriod = null) {
    const anchor = qs("[data-owner-future-section]") || qs("[data-owner-properties]");
    if (!anchor) return false;

    const periods = buildPeriods(financials);
    const period = selectedPeriod || defaultPeriod(periods);
    qs("[data-owner-finance-section]")?.remove();
    anchor.insertAdjacentHTML("beforebegin", financeHtml(financials, period));

    qs("[data-owner-finance-period]")?.addEventListener("change", (event) => {
      insertFinanceSection(financials, event.target.value);
    });

    return true;
  }

  async function init() {
    if (!document.body.matches("[data-page='owner-dashboard']")) return;

    const session = getSession();
    if (!session?.accessToken) return;

    try {
      const financials = await loadFinance(session);
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (insertFinanceSection(financials) || attempts > 30) window.clearInterval(timer);
      }, 250);
    } catch (_error) {
      // La section finances ne doit jamais bloquer le dashboard principal.
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
