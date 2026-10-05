#!/usr/bin/env bash
set -euo pipefail

mkdir -p assets/game/ingredients assets/game/drugs

fetch_asset() {
  local url="$1"
  local out="$2"
  echo "Fetching $url -> $out"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 1 "$url" -o "$out"
}

# Ingredient icons are sourced from the current rendered Schedule 1 Lab asset paths.
declare -A INGREDIENTS=(
  ["cuke.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fcuke.webp&w=96"
  ["banana.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fbanana.webp&w=96"
  ["paracetamol.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fparacetamol.webp&w=96"
  ["donut.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fdonut.webp&w=96"
  ["viagor.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fviagor.webp&w=96"
  ["mouth-wash.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fmouthwash.webp&w=96"
  ["flu-medicine.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fflu-medicine.webp&w=96"
  ["gasoline.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fgasoline.webp&w=96"
  ["energy-drink.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fenergy-drink.webp&w=96"
  ["motor-oil.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_2EpygqDj9tzvGFeVq4tzzdbX2BR9&q=75&url=%2Fimg%2Fingredients%2Fmotor-oil.webp&w=96"
  ["mega-bean.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fmega-bean.webp&w=96"
  ["chili.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fchili.webp&w=96"
  ["battery.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fbattery.webp&w=96"
  ["iodine.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fiodine.webp&w=96"
  ["addy.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Faddy.webp&w=96"
  ["horse-semen.webp"]="https://schedule1-lab.com/_next/image?dpl=dpl_3qtCHHhU7tqyv2TUUN13EUd7Gmix&q=75&url=%2Fimg%2Fingredients%2Fhorse-semen.webp&w=96"
)

for file in "${!INGREDIENTS[@]}"; do
  fetch_asset "${INGREDIENTS[$file]}" "assets/game/ingredients/$file"
done

# Verified CDN drug icons.
fetch_asset "https://cdn.schedule1.io/wiki/drugs/og-kush.png" "assets/game/drugs/og-kush.png"
fetch_asset "https://cdn.schedule1.io/wiki/drugs/sour-diesel.png" "assets/game/drugs/sour-diesel.png"
fetch_asset "https://cdn.schedule1.io/wiki/drugs/green-crack.png" "assets/game/drugs/green-crack.png"
fetch_asset "https://cdn.schedule1.io/wiki/drugs/granddaddy-purple.png" "assets/game/drugs/granddaddy-purple.png"
fetch_asset "https://cdn.schedule1.io/wiki/drugs/methamphetamine.png" "assets/game/drugs/meth.png"
fetch_asset "https://cdn.schedule1.io/wiki/drugs/cocaine.png" "assets/game/drugs/cocaine.png"

echo "Core verified asset sync complete. Shrooms icon remains pending exact-source verification."
