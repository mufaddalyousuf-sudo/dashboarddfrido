# Frido Marketplace Intelligence Dashboard

Static competitor-intelligence snapshot for Frido across Amazon India and Flipkart.
12 categories, organic / sponsored / combined page-1 rankings, pricing, ratings,
reviews, badges, opportunity scores and an action center.

## Deploy on Vercel

1. Import this repo at https://vercel.com/new (framework preset: **Other**, no build command, output dir: root).
2. Or CLI: `npx vercel --prod` from the repo root.

No build step — plain HTML/CSS/JS. Data lives in `data/*.json`.

## Refresh data

Re-run the capture scripts against amazon.in / flipkart.com, replace the JSON
files in `data/amazon-in/` and `data/flipkart/`, bump `asOf` in
`data/categories.json`, commit and redeploy.

Snapshot date: 2026-07-07.
