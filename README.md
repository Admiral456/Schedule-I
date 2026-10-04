# Schedule I Helper

GitHub-only static web app for Schedule I / Hyland Point.

## Current build

- large 2D map view with zoom/pan
- 66-customer database
- customer search and district/tier filters
- customer detail panel
- Recipe Finder
- recipe ingredients in exact order where supplied
- cost / sell / profit fields
- data separated into JSON files
- reconstruction data separated from verified data

## GitHub Pages

This project is intentionally static. No Vercel, Supabase or server is required for the current build.

Recommended Pages settings:
- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

## Important accuracy note

The interactive map source used during research states that some customer locations are still being surveyed. Therefore this repository does not invent customer coordinates or label reconstructed geometry as 1:1.

Sources:
- https://schedule1-lab.com/empire/map
- https://schedule1-lab.com/wiki/customers
- https://schedule1-lab.com/community/recipes

The project is a fan-made helper and is not affiliated with TVGS.
