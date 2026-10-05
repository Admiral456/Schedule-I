#!/usr/bin/env bash
set -euo pipefail

mkdir -p assets/game/customers

fetch_asset() {
  local url="$1"
  local out="$2"
  echo "Fetching $url -> $out"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 1 "$url" -o "$out"
  test -s "$out"
}

# Customer head/portrait assets are pinned to a specific MIT-licensed PopTracker commit.
# The JSON registry is the single source of filenames and provenance.
while IFS=$'\t' read -r url path; do
  [ -n "$url" ] || continue
  out="${path#./}"
  fetch_asset "$url" "$out"
done < <(jq -r '.customers[] | [.portrait.asset_url,.portrait.local_path] | @tsv' data/customer-portraits.json)

count=$(find assets/game/customers -type f -name '*.png' | wc -l | tr -d ' ')
expected=$(jq '.customers | length' data/customer-portraits.json)
if [ "$count" -ne "$expected" ]; then
  echo "Portrait sync mismatch: expected $expected PNG files, got $count"
  exit 1
fi

echo "Customer portrait sync complete: $count/$expected"
