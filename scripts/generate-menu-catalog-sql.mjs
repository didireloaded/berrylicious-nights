#!/usr/bin/env node
/**
 * Deterministically extracts Butcher Block Steakhouse's canonical Namibian menu
 * (`foodItems`, `drinkItems`, `PDF_SAUCE_ADDONS`) from `src/data/menu.ts`
 * and outputs idempotent PostgreSQL INSERT statements for `public.menu_catalog`
 * and `public.menu_sauce_addons`.
 *
 * Uses esbuild (already bundled by Vite) to evaluate `src/data/menu.ts` cleanly
 * with stubbed asset imports so server and client pricing never drift.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(path.join(repoRoot, "package.json"));
const esbuild = require("esbuild");

function sqlLiteral(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  return `'${String(val).replace(/'/g, "''")}'`;
}

export async function loadCanonicalMenu() {
  const menuPath = path.join(repoRoot, "src/data/menu.ts");
  const result = await esbuild.build({
    entryPoints: [menuPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [
      {
        name: "stub-images",
        setup(build) {
          build.onResolve({ filter: /\.(jpg|jpeg|png|webp|svg)$/i }, (args) => ({
            path: args.path,
            namespace: "img-stub",
          }));
          build.onLoad({ filter: /.*/, namespace: "img-stub" }, () => ({
            contents: 'export default "";',
            loader: "js",
          }));
        },
      },
    ],
  });

  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code, "utf8").toString("base64")}`;
  const mod = await import(dataUrl);
  return {
    menuItems: mod.menuItems,
    sauces: mod.PDF_SAUCE_ADDONS,
  };
}

export async function generateCatalogSql() {
  const { menuItems, sauces } = await loadCanonicalMenu();

  const lines = [
    "-- Auto-generated from src/data/menu.ts via scripts/generate-menu-catalog-sql.mjs",
    `-- Total menu items: ${menuItems.length} | Sauce add-ons: ${sauces.length}`,
    "",
    "INSERT INTO public.menu_sauce_addons (id, price, active) VALUES",
  ];

  const sauceRows = sauces.map(
    (s) => `  (${sqlLiteral(s.id)}, ${sqlLiteral(s.price)}, true)`,
  );
  lines.push(sauceRows.join(",\n"));
  lines.push("ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, active = EXCLUDED.active;");
  lines.push("");
  lines.push(
    "INSERT INTO public.menu_catalog (id, name, category, menu_section, base_price, price_label, variations, active) VALUES",
  );

  const itemRows = menuItems.map((item) => {
    const variationsJson =
      Array.isArray(item.variations) && item.variations.length > 0
        ? `${sqlLiteral(JSON.stringify(item.variations))}::jsonb`
        : "'[]'::jsonb";
    return `  (${sqlLiteral(item.id)}, ${sqlLiteral(item.name)}, ${sqlLiteral(item.category)}, ${sqlLiteral(item.menuSection)}, ${sqlLiteral(item.price)}, ${sqlLiteral(item.priceLabel ?? null)}, ${variationsJson}, true)`;
  });
  lines.push(itemRows.join(",\n"));
  lines.push(
    "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, menu_section = EXCLUDED.menu_section, base_price = EXCLUDED.base_price, price_label = EXCLUDED.price_label, variations = EXCLUDED.variations, active = EXCLUDED.active;",
  );
  lines.push("");

  return { sql: lines.join("\n"), itemCount: menuItems.length, sauceCount: sauces.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outArg = process.argv[2];
  generateCatalogSql()
    .then(({ sql, itemCount, sauceCount }) => {
      if (outArg) {
        fs.writeFileSync(path.resolve(outArg), sql, "utf8");
        console.log(`Wrote ${itemCount} menu items and ${sauceCount} sauces to ${outArg}`);
      } else {
        process.stdout.write(sql);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
