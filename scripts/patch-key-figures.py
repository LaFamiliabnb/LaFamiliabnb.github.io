from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")

new_style = '''  <style>
    .key-figures {
      width: 100%;
      padding: 24px 6% 58px;
    }

    .key-figures-heading {
      max-width: 1180px;
      margin: 0 auto 30px;
      text-align: center;
    }

    .key-figures-heading h2 {
      margin-top: 0;
      margin-bottom: 14px;
    }

    .key-figures-heading p {
      margin: 0;
      font-size: 1.08rem;
    }

    .key-figures .trust-strip {
      max-width: 1180px;
      margin: 0 auto;
      padding: 0;
    }

    .key-figures .trust-item {
      display: flex;
      min-height: 190px;
      min-width: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 20px;
    }

    .key-figures .trust-item strong {
      font-family: "PlayfairDisplay", Georgia, serif;
      font-size: clamp(2.25rem, 4vw, 3.25rem);
      line-height: 1;
      letter-spacing: -.035em;
      white-space: nowrap;
    }

    .key-figures .trust-item span {
      display: block;
      font-weight: 900;
      line-height: 1.35;
    }

    .key-figures .revenue-card strong {
      font-size: clamp(1.65rem, 2.1vw, 2.35rem);
    }

    .key-figures-note {
      max-width: 1180px;
      margin: 20px auto 0;
      color: var(--muted);
      font-size: .82rem;
      line-height: 1.55;
      text-align: center;
    }

    @media (max-width: 980px) {
      .key-figures { padding-top: 8px; }
      .key-figures .trust-item { min-height: 0; }
    }
  </style>'''

if ".key-figures .revenue-card strong" not in text:
    text, style_count = re.subn(
        r"  <style>\n    \.key-figures \{.*?  </style>",
        new_style,
        text,
        count=1,
        flags=re.DOTALL,
    )
    if style_count != 1:
        raise SystemExit("Le bloc de styles des chiffres n'a pas été trouvé de façon unique.")

    replacements = [
        (
            '        <span class="eyebrow"><i class="fas fa-chart-line" aria-hidden="true"></i> Des résultats vérifiables</span>\n',
            '',
        ),
        (
            '      <div class="trust-strip" aria-label="Chiffres clés de La Familia">',
            '      <div class="trust-strip key-figures-grid" aria-label="Chiffres clés de La Familia">',
        ),
        (
            '        <div class="trust-item"><strong>1 337 890 €</strong><span>de revenus générés</span><small>pour nos propriétaires en 2025</small></div>',
            '        <div class="trust-item revenue-card"><strong>1&nbsp;337&nbsp;890&nbsp;€</strong><span>de revenus générés</span><small>pour nos propriétaires en 2025</small></div>',
        ),
    ]

    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"Motif HTML introuvable : {old}")
        text = text.replace(old, new, 1)

    path.write_text(text, encoding="utf-8")
else:
    print("Le correctif est déjà appliqué.")
