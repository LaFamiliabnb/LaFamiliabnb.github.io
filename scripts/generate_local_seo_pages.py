#!/usr/bin/env python3
"""Generate La Familia local SEO pages from reviewed data and static templates."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from string import Template
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
DATA = json.loads((SCRIPTS / "local-seo-data.json").read_text(encoding="utf-8"))
CITIES = DATA["cities"]
REVIEWS = DATA["reviews"]
CITY_TEMPLATE = Template(
    (SCRIPTS / "local-seo-template-part1.html").read_text(encoding="utf-8")
    + (SCRIPTS / "local-seo-template-part2.html").read_text(encoding="utf-8")
)
esc = html.escape


def faq_items(city: dict) -> list[tuple[str, str]]:
    article = city["article"]
    return [
        (f"La Familia intervient-elle {article} ?", "Oui, sous réserve de validation de l’adresse, du type de logement et de la faisabilité opérationnelle. L’objectif est de garantir une qualité de ménage, de linge, d’arrivée et de suivi cohérente avec le service proposé."),
        (f"Combien peut rapporter un Airbnb {article} ?", "Le revenu ne peut pas être déduit de la seule commune. Il dépend de l’adresse, de la surface, des couchages, du standing, du stationnement, des extérieurs, des photos, des avis, du calendrier et de la réglementation applicable."),
        ("Quels services sont compris dans la gestion ?", "La gestion peut couvrir l’annonce, les plateformes, les messages voyageurs, les arrivées, les départs, le ménage, le linge, le suivi des avis, l’ajustement des prix et le reporting propriétaire."),
        ("Puis-je conserver des dates pour mon usage personnel ?", "Oui. Le propriétaire peut bloquer des périodes, sous réserve d’anticiper les réservations déjà confirmées et d’intégrer ces indisponibilités dans la stratégie de revenus."),
        ("Faut-il proposer une boîte à clés ou une serrure connectée ?", "Le bon dispositif dépend de la porte, de la copropriété, de la couverture réseau, de la fréquence des arrivées et du besoin de solution de secours. La simplicité pour le voyageur ne doit pas réduire la sécurité."),
        ("Les données Insee permettent-elles de prévoir les revenus Airbnb ?", "Non. Elles donnent un contexte démographique et résidentiel, mais ne remplacent pas l’étude des annonces concurrentes, de la demande réelle, des événements, du calendrier et des caractéristiques du logement."),
    ]


def render_city(city: dict) -> str:
    slug_map = {value["name"]: value["slug"] for value in CITIES.values()}
    profiles_html = "".join(f"<li>{esc(item.capitalize())}.</li>" for item in city["profiles"])
    properties_html = "".join(
        f'<article class="card"><h3>{esc(item.capitalize())}</h3>'
        "<p>Le potentiel dépend de l’emplacement précis, de la capacité, de la qualité des équipements, du calendrier disponible et de la manière dont le bien est présenté.</p></article>"
        for item in city["properties"]
    )
    challenges_html = "".join(f"<li>{esc(item.capitalize())}.</li>" for item in city["challenges"])
    reviews_html = "".join(
        f'<article class="review"><div class="stars">★★★★★</div><p>{esc(quote)}</p><cite>{esc(source)}</cite></article>'
        for quote, source in REVIEWS
    )
    links = []
    for name in city["local_links"]:
        href = "/conciergerie-airbnb-aix-en-provence/" if name == "Aix-en-Provence" else f"/conciergerie-airbnb-{slug_map[name]}/"
        links.append(f'<a href="{href}">Conciergerie Airbnb {esc(name)}</a>')
    local_links_html = "".join(links)

    faqs = faq_items(city)
    faq_html = "".join(f"<details><summary>{esc(question)}</summary><p>{esc(answer)}</p></details>" for question, answer in faqs)
    faq_json = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": question, "acceptedAnswer": {"@type": "Answer", "text": answer}} for question, answer in faqs]}, ensure_ascii=False)
    service_json = json.dumps({"@context": "https://schema.org", "@type": "Service", "name": f"Conciergerie Airbnb {city['name']}", "serviceType": "Gestion de location courte durée et conciergerie Airbnb", "provider": {"@id": "https://www.lafamiliabnb.fr/#business"}, "areaServed": {"@type": "AdministrativeArea", "name": city["name"]}, "url": f"https://www.lafamiliabnb.fr/conciergerie-airbnb-{city['slug']}/"}, ensure_ascii=False)
    breadcrumb_json = json.dumps({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.lafamiliabnb.fr/"}, {"@type": "ListItem", "position": 2, "name": "Zones d’intervention", "item": "https://www.lafamiliabnb.fr/zones-intervention/"}, {"@type": "ListItem", "position": 3, "name": f"Conciergerie Airbnb {city['name']}", "item": f"https://www.lafamiliabnb.fr/conciergerie-airbnb-{city['slug']}/"}]}, ensure_ascii=False)
    values = {**city, "profiles_html": profiles_html, "properties_html": properties_html, "challenges_html": challenges_html, "reviews_html": reviews_html, "local_links_html": local_links_html, "faq_html": faq_html, "faq_json": faq_json, "service_json": service_json, "breadcrumb_json": breadcrumb_json}
    return CITY_TEMPLATE.substitute(values)


def write_pages() -> None:
    zones = (SCRIPTS / "zones-index-part1.html").read_text(encoding="utf-8") + (SCRIPTS / "zones-index-part2.html").read_text(encoding="utf-8")
    zones_path = ROOT / "zones-intervention" / "index.html"
    zones_path.parent.mkdir(parents=True, exist_ok=True)
    zones_path.write_text(zones, encoding="utf-8")
    for city in CITIES.values():
        path = ROOT / f"conciergerie-airbnb-{city['slug']}" / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_city(city), encoding="utf-8")


def patch_pillar() -> None:
    path = ROOT / "conciergerie-airbnb-aix-en-provence" / "index.html"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'\n\s*<section class="section" id="zones">.*?</section>\s*(?=<section class="section alt" id="equipe">)', "\n\n", text, flags=re.S)
    text = re.sub(r"<!-- LOCAL-ZONES-CTA:START -->.*?<!-- LOCAL-ZONES-CTA:END -->", "", text, flags=re.S)
    block = '''    <!-- LOCAL-ZONES-CTA:START -->
    <section class="section alt" id="zones">
      <div class="container" style="text-align:center;">
        <h2>Nos secteurs d’intervention</h2>
        <p class="section-intro" style="margin-left:auto;margin-right:auto;">Nous accompagnons les propriétaires à Aix-en-Provence et dans les communes voisines.</p>
        <div class="actions" style="justify-content:center;">
          <a href="/zones-intervention/" class="button secondary">Voir toutes nos zones d’intervention <i class="fas fa-arrow-right"></i></a>
        </div>
      </div>
    </section>
    <!-- LOCAL-ZONES-CTA:END -->

'''
    anchor = '    <section class="section dark" id="contact">'
    if anchor not in text:
        raise RuntimeError("Contact section anchor not found")
    text = text.replace(anchor, block + anchor, 1)
    zones_nav = '          <li><a href="/zones-intervention/">Zones</a></li>\n'
    conciergerie_nav = '          <li><a href="/conciergerie-airbnb-aix-en-provence/">Conciergerie</a></li>\n'
    if zones_nav not in text:
        text = text.replace(conciergerie_nav, conciergerie_nav + zones_nav, 1)
    path.write_text(text, encoding="utf-8")


def update_sitemap() -> None:
    path = ROOT / "sitemap.xml"
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", namespace)
    tree = ET.parse(path)
    root = tree.getroot()
    ns = f"{{{namespace}}}"
    existing = {node.findtext(ns + "loc") for node in root.findall(ns + "url")}
    entries = [("https://www.lafamiliabnb.fr/zones-intervention/", "0.85")]
    entries.extend((f"https://www.lafamiliabnb.fr/conciergerie-airbnb-{city['slug']}/", "0.78") for city in CITIES.values())
    for loc, priority in entries:
        if loc in existing:
            continue
        url = ET.SubElement(root, ns + "url")
        ET.SubElement(url, ns + "loc").text = loc
        ET.SubElement(url, ns + "lastmod").text = "2026-07-28"
        ET.SubElement(url, ns + "changefreq").text = "monthly"
        ET.SubElement(url, ns + "priority").text = priority
    ET.indent(tree, space="  ")
    tree.write(path, encoding="UTF-8", xml_declaration=True)


def main() -> None:
    write_pages()
    patch_pillar()
    update_sitemap()


if __name__ == "__main__":
    main()
