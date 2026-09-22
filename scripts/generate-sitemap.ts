// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync, readdirSync } from "fs"
import { resolve } from "path"

const BASE_URL = "https://whybitcoin101.com"

interface SitemapEntry {
  path: string
  lastmod?: string
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority?: string
}

// Static, indexable routes (from src/App.tsx; /question/:key and /coming-soon are excluded —
// user-specific and redirect pages should not be indexed).
const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/mission", changefreq: "monthly", priority: "0.8" },
  { path: "/get-involved", changefreq: "monthly", priority: "0.8" },
  { path: "/pulse-layer", changefreq: "daily", priority: "0.7" },
]

// One entry per published shareable video page (mirrors public/video/<slug>).
const videoSlugs = readdirSync(resolve("public/video")).filter((name) =>
  !name.includes(".")
)
for (const slug of videoSlugs) {
  entries.push({ path: `/video/${slug}`, changefreq: "monthly", priority: "0.6" })
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  )

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n")
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries))
console.log(`sitemap.xml written (${entries.length} entries)`)
