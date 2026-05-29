#!/usr/bin/env node
// Generates content/PAGE.md from the landing page source components.
// Run via the generate-content GitHub Action whenever source files change.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Landing page sections, in render order (see src/pages/Index.tsx).
const sections = [
  { file: "src/components/Hero.tsx", title: "Hero", constName: "heroText" },
  { file: "src/components/MoneyProblem.tsx", title: "Why Bitcoin in the First Place?", constName: "moneyProblemText" },
  { file: "src/components/Basics.tsx", title: "Bitcoin Basics", constName: "basicsText" },
  { file: "src/components/WhyBitcoin.tsx", title: "Building Tomorrow Together", constName: "whyBitcoinText" },
  { file: "src/components/Resources.tsx", title: "Dive Deeper", constName: "resourcesText" },
  { file: "src/components/FAQ.tsx", title: "Common Questions", constName: "faqText" },
  { file: "src/components/Contact.tsx", title: "Connect & Learn Together", constName: null },
];

const stripJsx = (s) =>
  s
    .replace(/\{"\s+"\}/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

// Normalize a section body: preserve paragraph breaks, collapse single newlines into one blank line.
const normalizeParagraphs = (s) =>
  s
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

function extractBacktickConst(src, name) {
  const re = new RegExp("const\\s+" + name + "\\s*=\\s*`([\\s\\S]*?)`", "m");
  const m = src.match(re);
  return m ? m[1].trim() : null;
}

function extractCopyButtonTexts(src) {
  // Matches: <CopyButton text="..." ... /> (only the double-quoted string form)
  const out = [];
  const re = /<CopyButton[^>]*\stext="((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim());
  }
  return out;
}

const lines = [];
lines.push("# Why Bitcoin 101");
lines.push("");
lines.push("> A plain-text snapshot of the whybitcoin101.com landing page, auto-generated from the source components.");
lines.push("");

for (const section of sections) {
  const src = readFileSync(resolve(root, section.file), "utf8");

  let body = null;
  if (section.constName) {
    body = extractBacktickConst(src, section.constName);
  }

  if (!body) {
    // Fall back to concatenating every CopyButton text in the file.
    const texts = extractCopyButtonTexts(src);
    if (texts.length) body = texts.join("\n\n");
  }

  if (!body) {
    console.warn(`No content extracted for ${section.file}, skipping.`);
    continue;
  }

  lines.push(`## ${section.title}`);
  lines.push("");
  lines.push(normalizeParagraphs(stripJsx(body)));
  lines.push("");
}

lines.push("---");
lines.push("");
lines.push(`<sub>Auto-generated from source on ${new Date().toISOString().slice(0, 10)}.</sub>`);
lines.push("");

const outDir = resolve(root, "content");
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, "PAGE.md");
writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${out} (${sections.length} sections)`);