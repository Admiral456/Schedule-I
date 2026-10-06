using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MelonLoader;
using Newtonsoft.Json;
using ScheduleOne.DevUtilities;
using ScheduleOne.Effects;
using ScheduleOne.Product;
using UnityEngine;

namespace Schedule1HelperBridge;

public sealed class Main : MelonMod
{
    private bool exportedOnce;

    public override void OnUpdate()
    {
        if (Input.GetKeyDown(KeyCode.F8))
        {
            try
            {
                ExportRuntimeSnapshot();
            }
            catch (Exception ex)
            {
                MelonLogger.Error("[Schedule 1 Helper Bridge] " + ex);
            }
        }

        if (!exportedOnce && NetworkSingleton<GameManager>.Instance != null)
        {
            try
            {
                ExportRuntimeSnapshot();
                exportedOnce = true;
            }
            catch (Exception ex)
            {
                MelonLogger.Error("[Schedule 1 Helper Bridge] initial export failed: " + ex.Message);
            }
        }
    }

    private static readonly (string Ingredient, string BaseEffect)[] Ingredients =
    {
        ("Cuke", "Energizing"),
        ("Banana", "Gingeritis"),
        ("Paracetamol", "Sneaky"),
        ("Donut", "Calorie-Dense"),
        ("Viagor", "Tropic Thunder"),
        ("Mouth Wash", "Balding"),
        ("Flu Medicine", "Sedating"),
        ("Gasoline", "Toxic"),
        ("Energy Drink", "Athletic"),
        ("Motor Oil", "Slippery"),
        ("Mega Bean", "Foggy"),
        ("Chili", "Spicy"),
        ("Battery", "Bright-Eyed"),
        ("Iodine", "Jennerising"),
        ("Addy", "Thought-Provoking"),
        ("Horse Semen", "Long Faced")
    };

    private static readonly EDrugType[] DrugTypes =
    {
        EDrugType.Weed,
        EDrugType.Meth,
        EDrugType.Cocaine,
        EDrugType.Shrooms
    };

    private void ExportRuntimeSnapshot()
    {
        var gameManager = NetworkSingleton<GameManager>.Instance;
        if (gameManager == null)
            throw new InvalidOperationException("GameManager is not loaded.");

        var productManager = NetworkSingleton<ProductManager>.Instance;
        if (productManager == null)
            throw new InvalidOperationException("ProductManager is not loaded.");

        var rules = new List<Rule>();

        foreach (var drug in DrugTypes)
        {
            var map = productManager.GetMixerMap(drug);
            if (map == null)
                continue;

            foreach (var ingredient in Ingredients)
            {
                var added = map.Effects.FirstOrDefault(
                    x => SameName(x?.Property, ingredient.BaseEffect));

                if (added == null)
                    continue;

                var delta = added.Property.MixDirection * added.Property.MixMagnitude;

                foreach (var existing in map.Effects)
                {
                    if (existing?.Property == null)
                        continue;

                    var output = map.GetEffectAtPoint(existing.Position + delta);
                    if (output == null || SameName(existing.Property, output))
                        continue;

                    rules.Add(new Rule
                    {
                        Drug = drug.ToString(),
                        Ingredient = ingredient.Ingredient,
                        From = existing.Property.Name,
                        To = output.Name
                    });
                }
            }
        }

        var snapshot = new Snapshot
        {
            Version = 1,
            Source = "schedule1-runtime-mixer-map",
            Seed = GameManager.Seed,
            GeneratedAtUtc = DateTime.UtcNow,
            Rules = rules
                .GroupBy(x => $"{x.Drug}::{x.Ingredient}::{x.From}::{x.To}")
                .Select(x => x.First())
                .ToList()
        };

        var outputDirectory = Path.Combine(
            MelonEnvironment.UserDataDirectory,
            "Schedule1Helper");

        Directory.CreateDirectory(outputDirectory);

        var outputPath = Path.Combine(
            outputDirectory,
            "schedule1-helper-seeded-runtime.json");

        File.WriteAllText(
            outputPath,
            JsonConvert.SerializeObject(snapshot, Formatting.Indented));

        MelonLogger.Msg(
            "[Schedule 1 Helper Bridge] exported seed " +
            snapshot.Seed +
            " with " +
            snapshot.Rules.Count +
            " runtime mixer rules to " +
            outputPath);
    }

    private static bool SameName(Effect a, string name) =>
        a != null &&
        string.Equals(a.Name, name, StringComparison.OrdinalIgnoreCase);

    private static bool SameName(Effect a, Effect b) =>
        a != null &&
        b != null &&
        string.Equals(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);

    private sealed class Rule
    {
        [JsonProperty("drug")]
        public string Drug { get; set; } = "";

        [JsonProperty("ingredient")]
        public string Ingredient { get; set; } = "";

        [JsonProperty("from")]
        public string From { get; set; } = "";

        [JsonProperty("to")]
        public string To { get; set; } = "";
    }

    private sealed class Snapshot
    {
        [JsonProperty("version")]
        public int Version { get; set; }

        [JsonProperty("source")]
        public string Source { get; set; } = "";

        [JsonProperty("seed")]
        public int Seed { get; set; }

        [JsonProperty("generatedAtUtc")]
        public DateTime GeneratedAtUtc { get; set; }

        [JsonProperty("rules")]
        public List<Rule> Rules { get; set; } = new();
    }
}
