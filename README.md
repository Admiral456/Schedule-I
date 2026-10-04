# Schedule 1 Helper

GitHub-only static web app for Schedule I / Hyland Point.

## Current build

- large Hyland Point 2D map reference with map-icon layer
- mouse/touch-friendly zoom and pan
- 66-customer database
- customer search
- district and tier filters
- customer detail panel
- orders/week and budget fields
- Recipe Finder
- recipe search by name, ingredient and effect
- drug filter: Meth, Weed, Shrooms, Cocaine
- ingredient order shown explicitly
- cost, sell price and profit
- recipe records from published community data plus the user-supplied 8-ingredient recipe
- separate JSON data for customers, recipes, buildings, roads and props
- 3D mode intentionally marked Coming Soon until verified geometry is available
- no invented customer coordinates

## GitHub Pages

This project is intentionally static and deployed directly from GitHub.

The repository contains `.github/workflows/deploy.yml`, which publishes the repository contents to GitHub Pages on every push to `main` and can also be started manually from GitHub Actions.

GitHub setup:

1. Open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. After the workflow runs successfully, GitHub Pages provides the published site URL.

Official GitHub guidance:
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically

## Project layout

```text
Schedule-I/
├── index.html
├── assets/
│   ├── helper.css
│   └── map-icons/
├── data/
│   ├── customers.json
│   ├── recipes.json
│   ├── hyland-point.json
│   ├── buildings.json
│   ├── roads.json
│   └── props.json
├── js/
│   └── app.js
└── .github/
    └── workflows/
        └── deploy.yml
```

## Account, sharing and security

- local display-name profile without password storage
- configurable Share ID
- share links encode only public view/filter/entity state in the URL
- Saved workspace is not embedded in share links
- JSON export/import for Saved workspace and local settings
- security center and Content Security Policy metadata
- local data can be deleted from the Account page

Secure email/CAPTCHA/13-digit OTP login is not implemented as a fake client-side feature. GitHub Pages is static, so real server-side OTP verification and secret authentication keys require a separate backend.

## Accuracy

The public interactive map used as reference is still being surveyed and explicitly notes that some customer locations are not yet confirmed. This project therefore does not invent customer coordinates or present reconstructed building geometry as 1:1.

## Sources

- https://schedule1-lab.com/empire/map
- https://schedule1-lab.com/wiki/customers
- https://schedule1-lab.com/community/recipes
- https://steamcommunity.com/sharedfiles/filedetails/?id=3672513712
- https://steamcommunity.com/sharedfiles/filedetails/?id=3455934757

The project is a fan-made helper and is not affiliated with TVGS.
