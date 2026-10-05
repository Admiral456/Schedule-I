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
- custom web logo upload stored locally in the current browser
- per-category + buttons in Moje uložené
- room images from local file/gallery
- employee → room assignment with temporary map highlight
- shared folders with read-only URL snapshots
- Update button + version.json release manifest + progress update bar
- dynamic Co je nového release panel
- share-link verification for ID, title, type and filters
- central source/provenance registry in data/sources.json
- customer portrait source plan prepared; no portrait is invented or substituted
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
│   ├── sources.json
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

The complete source/provenance registry is maintained in `data/sources.json`.

Primary/current references:
- https://schedule1-lab.com/empire/map
- https://schedule1-lab.com/wiki/customers
- https://schedule1-lab.com/community/recipes
- https://schedule1.io/wiki/drugs
- https://www.schedule1wiki.org/customers
- https://www.schedule1wiki.org/items
- https://www.schedule1wiki.org/drugs
- https://www.schedule1wiki.org/locations
- https://schedule1.app/customers/
- https://scheduleonemixer.com/customers

Additional map/NPC cross-checks:
- https://www.playerauctions.com/schedule-1-guide/tips-guides/all-npc-locations-and-schedules/
- https://techsngames.com/schedule-1-all-customer-locations-preferences/
- https://maps.tcno.co/maps/s1
- https://wand.com/de/maps/schedule-i/hyland-point
- https://steamcommunity.com/sharedfiles/filedetails/?id=3672513712
- https://steamcommunity.com/sharedfiles/filedetails/?id=3455934757
- https://schedule-1.fandom.com/

### Customer heads / portraits

Customer portraits are treated as separate assets from customer data. The preferred order is:
1. exact customer profile photo from schedule1.app
2. customer image from ScheduleOneMixer
3. verified game-derived wiki/Fandom image
4. another clearly game-derived source only after verification

Before adding a portrait to the public repository, its direct asset URL, source page and verification status must be recorded in the data. Random real-person photos and invented replacements are not allowed.

The project is a fan-made helper and is not affiliated with TVGS.


## Updates and shared folders

New releases are recorded in `version.json`. Active browsers check that manifest approximately once per minute. When a newer release is detected, the helper shows the "Právě aktualizujeme web" progress bar and reloads after the progress completes.

The Update button performs a confirmed version check. Publishing still happens through a commit to `main` and the GitHub Pages workflow; the browser must not contain a GitHub write token.

Shared folders are local workspace folders containing snapshots of saved Recipes, Customers, Employees, Rooms and Other entries. The share link contains the snapshot itself. It is read-only for recipients and can be copied into their own workspace. It is not a realtime multi-user database.

Custom logos and room images are stored locally in the current browser in GitHub-only mode and are not uploaded to the public repository automatically.
