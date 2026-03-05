# SASB Case Study Website

Statische Website fuer den SASB Case Study Funnel, optimiert fuer GitHub Pages.

## Build/Publish Logik

Die Seiten werden aus einer einzigen Quellstruktur gebaut (`index.html`, `ablauf/`, `loesung/`, `termin/`, `beweis/`, `assets/`).

Beim Deploy erzeugt `scripts/prepare-pages.sh` ein Publish-Artefakt in `_site/`, das beide Pfade bereitstellt:

- Root (`/`)
- Legacy/Subpfad (`/SASB_CaseStudy/`)

So bleibt die Pflege ohne doppelte Dateien im Repository, waehrend bestehende Links weiter funktionieren.

## Struktur

- `index.html`
- `loesung/index.html`
- `ablauf/index.html`
- `termin/index.html`
- `beweis/index.html`
- `assets/style.css`
- `assets/theme.js`

## Deployment (GitHub Pages)

Der Workflow unter `.github/workflows/deploy.yml` deployed automatisch bei jedem Push auf `main`.
Vor dem Upload wird `scripts/prepare-pages.sh` ausgefuehrt und `_site/` als Artifact veroeffentlicht.

## Einmaliges Setup in GitHub

1. Repository auf GitHub anlegen und Code pushen.
2. Unter `Settings > Pages` als Source `GitHub Actions` waehlen.
3. Auf `main` pushen.

Danach ist die Seite unter der GitHub-Pages-URL des Repos erreichbar.
