import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Recursively discover local CSS files referenced by @import statements.
 *
 * Resolution rules:
 *   - Skip @import url(...) — filtered out by regex
 *   - Skip bare module imports (no file extension, e.g. "tailwindcss")
 *   - Resolve everything else relative to the file containing the @import
 *   - Recurse into each resolved file; use a Set to prevent circular loops
 *
 * @param {string} filePath  Absolute path to a CSS file
 * @param {object} [logger]  Optional callbacks: { onSkipBare, onSkipNotFound, onWatch }
 * @param {Set}    [seen]    Internal — tracks visited files to avoid circular imports
 * @returns {string[]}       Absolute paths of discovered local CSS imports
 */
export function resolveImports(filePath, logger = {}, seen = new Set()) {
  const imports = [];
  if (!existsSync(filePath) || seen.has(filePath)) return imports;
  seen.add(filePath);

  const raw = readFileSync(filePath, 'utf-8');
  const dir = path.dirname(filePath);

  // Strip CSS comments (/* ... */) so we don't match @import inside comments
  const content = raw.replace(/\/\*[\s\S]*?\*\//g, '');

  // Match @import "..." or @import '...' — but not @import url(...)
  const importRegex = /@import\s+(?!url\()['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip bare module imports (no file extension).
    // e.g. "tailwindcss", "open-props/normalize" — these are npm packages, not local files.
    // Imports with a file extension like "components/button.css" are treated as local.
    if (path.extname(importPath) === '') {
      logger.onSkipBare?.(importPath);
      continue;
    }

    const resolved = path.resolve(dir, importPath);

    if (!existsSync(resolved)) {
      logger.onSkipNotFound?.(resolved);
      continue;
    }

    // Only add if not already seen (prevents circular imports appearing in results)
    if (!seen.has(resolved)) {
      logger.onWatch?.(resolved);
      imports.push(resolved);

      // Recurse into nested imports
      imports.push(...resolveImports(resolved, logger, seen));
    }
  }

  return imports;
}
