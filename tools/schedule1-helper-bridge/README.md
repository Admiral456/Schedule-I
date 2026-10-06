# Schedule 1 Helper runtime bridge

This folder contains a small MelonLoader game-side exporter for exact save-specific Seeded Mixing data.

## What it does

The browser cannot directly read the live Unity runtime. The bridge therefore reads the active game state and exports a JSON snapshot containing:

- the exact active save seed from \`GameManager.Seed\`
- the runtime \`ProductManager\` mixer maps
- the transformations derived from the current mixer-map geometry
- the drug type associated with each rule

When the save is loaded, the bridge exports once automatically. Press **F8** to export again.

The file is written to:

\`UserData/Schedule1Helper/schedule1-helper-seeded-runtime.json\`

The Helper imports this file under **Recipe Finder → Seeded Mixing → Načíst runtime export**.

## Why this is used

A seed value by itself is not enough for the website to safely reproduce the complete runtime mixer state. The bridge reads the actual mixer maps that the game has loaded for that save instead of guessing the rules from the seed.

## Build requirements

Build the source against the current Schedule I game assemblies and MelonLoader setup, including the assemblies that provide:

- \`ScheduleOne.DevUtilities.GameManager\`
- \`ScheduleOne.Product.ProductManager\`
- \`ScheduleOne.Product.EDrugType\`
- \`ScheduleOne.Effects.Effect\`
- UnityEngine
- Newtonsoft.Json
- MelonLoader

The public game-side references used by this source include \`GameManager.Seed\`, \`ProductManager.GetMixerMap(EDrugType)\`, mixer-map effects, effect \`MixDirection\` / \`MixMagnitude\`, and \`MixerMap.GetEffectAtPoint\`.

The exporter is intentionally kept separate from the website so the static Helper never needs access to the user's game files or private save data.
