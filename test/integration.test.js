/**
 * Integration tests — run real Eleventy builds with the plugin installed.
 *
 * Each test creates a temporary Eleventy project with a specific configuration
 * permutation, runs `eleventy`, and verifies the output CSS is correct.
 *
 * These tests give the highest confidence that the plugin works end-to-end
 * because they exercise the real Eleventy lifecycle (config resolution,
 * event firing, file writing) rather than mocked versions.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const pluginPath = path.resolve(import.meta.dirname, '..');
const eleventyBin = path.join(pluginPath, 'node_modules', '.bin', 'eleventy');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scaffolds a temporary Eleventy project.
 *
 * Returns { tmpDir, srcDir, outDir } and creates:
 *   - eleventy.config.js  (ES module, imports plugin from this repo)
 *   - src/index.html       (minimal template)
 *   - src/<cssPath>         (tailwind source CSS)
 *   - node_modules symlink  (so the plugin + deps resolve)
 *   - package.json          (type: module)
 */
async function scaffoldProject({
  cssPath = 'css/tailwind.css',
  cssContent = '@import "tailwindcss";',
  outputOption = undefined,       // plugin output option
  minify = false,
  debug = false,
  inputDir = 'src',
  outputDir = '_site',
  extraConfig = '',               // extra lines inside the config function
  extraCSS = '',                  // extra CSS files to create (array of {path, content})
} = {}) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'etw-integ-'));
  const srcDir = path.join(tmpDir, inputDir);

  // Create source directories
  const cssFullDir = path.join(srcDir, path.dirname(cssPath));
  await mkdir(cssFullDir, { recursive: true });

  // Write CSS source
  await writeFile(path.join(srcDir, cssPath), cssContent);

  // Write extra CSS files if provided
  if (extraCSS && Array.isArray(extraCSS)) {
    for (const file of extraCSS) {
      const fullPath = path.join(srcDir, file.path);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content);
    }
  }

  // Write a minimal HTML template
  await writeFile(path.join(srcDir, 'index.html'), `<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="/styles.css"></head>
<body><h1 class="text-red-500">Hello</h1></body>
</html>`);

  // Write package.json
  await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    type: 'module',
  }));

  // Build plugin options string
  const opts = [`input: '${cssPath}'`];
  if (outputOption) opts.push(`output: '${outputOption}'`);
  if (minify) opts.push(`minify: true`);
  if (debug) opts.push(`debug: true`);
  const optsStr = opts.join(', ');

  // Write eleventy config
  await writeFile(path.join(tmpDir, 'eleventy.config.js'), `
import tailwindcss from '${pluginPath}/index.js';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(tailwindcss, { ${optsStr} });
  ${extraConfig}
  return {
    dir: { input: '${inputDir}', output: '${outputDir}' }
  };
}
`);

  // Symlink node_modules so everything resolves
  await symlink(
    path.join(pluginPath, 'node_modules'),
    path.join(tmpDir, 'node_modules'),
    'junction'
  );

  return {
    tmpDir,
    srcDir,
    outDir: path.join(tmpDir, outputDir),
  };
}

/**
 * Runs an Eleventy build in the given project directory.
 * Returns { stdout, stderr }.
 */
async function runBuild(projectDir) {
  try {
    const result = await execFileAsync(eleventyBin, [], {
      cwd: projectDir,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30000,
    });
    return result;
  } catch (err) {
    // Eleventy may exit with non-zero but still produce output
    return { stdout: err.stdout || '', stderr: err.stderr || '', error: err };
  }
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('integration — real Eleventy builds', () => {
  const tmpDirs = [];

  afterEach(async () => {
    for (const dir of tmpDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  // ---- 1. Basic build with defaults ----
  it('basic build: produces CSS at default output path', async () => {
    const { tmpDir, outDir } = await scaffoldProject();
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const cssFile = path.join(outDir, 'styles.css');
    expect(existsSync(cssFile)).toBe(true);

    const css = await readFile(cssFile, 'utf-8');
    expect(css.length).toBeGreaterThan(100); // real Tailwind output
  }, 30000);

  // ---- 2. Custom output path ----
  it('custom output: writes CSS to specified output path', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      outputOption: 'assets/css/compiled.css',
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const cssFile = path.join(outDir, 'assets', 'css', 'compiled.css');
    expect(existsSync(cssFile)).toBe(true);

    const css = await readFile(cssFile, 'utf-8');
    expect(css.length).toBeGreaterThan(100);
  }, 30000);

  // ---- 3. Minified output ----
  it('minified build: output is smaller than unminified', async () => {
    // Unminified
    const proj1 = await scaffoldProject({ minify: false });
    tmpDirs.push(proj1.tmpDir);
    await runBuild(proj1.tmpDir);
    const unminified = await readFile(path.join(proj1.outDir, 'styles.css'), 'utf-8');

    // Minified
    const proj2 = await scaffoldProject({ minify: true });
    tmpDirs.push(proj2.tmpDir);
    await runBuild(proj2.tmpDir);
    const minified = await readFile(path.join(proj2.outDir, 'styles.css'), 'utf-8');

    expect(minified.length).toBeLessThan(unminified.length);
  }, 60000);

  // ---- 4. Custom input directory ----
  it('custom input dir: works with non-default input directory', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      inputDir: 'content',
      outputDir: 'public',
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const cssFile = path.join(outDir, 'styles.css');
    expect(existsSync(cssFile)).toBe(true);
  }, 30000);

  // ---- 5. Custom output directory ----
  it('custom output dir: writes to non-default output directory', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      outputDir: 'dist',
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const cssFile = path.join(outDir, 'styles.css');
    expect(existsSync(cssFile)).toBe(true);

    // Verify it did NOT write to _site
    expect(existsSync(path.join(tmpDir, '_site', 'styles.css'))).toBe(false);
  }, 30000);

  // ---- 6. CSS with @import of local partials ----
  it('CSS imports: processes CSS that @imports local partials', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      cssContent: [
        '@import "tailwindcss";',
        '@import "./_partials/custom.css";',
      ].join('\n'),
      extraCSS: [
        {
          path: 'css/_partials/custom.css',
          content: '.custom-class { color: purple; }',
        },
      ],
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const css = await readFile(path.join(outDir, 'styles.css'), 'utf-8');
    // The imported partial's content should be in the output
    expect(css).toContain('.custom-class');
    expect(css).toContain('purple');
  }, 30000);

  // ---- 7. Multiple CSS partials ----
  it('multiple partials: all @imported files are included in output', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      cssContent: [
        '@import "tailwindcss";',
        '@import "./_partials/buttons.css";',
        '@import "./_partials/cards.css";',
        '@import "./_partials/layout.css";',
      ].join('\n'),
      extraCSS: [
        { path: 'css/_partials/buttons.css', content: '.btn { padding: 8px 16px; }' },
        { path: 'css/_partials/cards.css', content: '.card { border-radius: 8px; }' },
        { path: 'css/_partials/layout.css', content: '.container { max-width: 1200px; }' },
      ],
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const css = await readFile(path.join(outDir, 'styles.css'), 'utf-8');
    expect(css).toContain('.btn');
    expect(css).toContain('.card');
    expect(css).toContain('.container');
  }, 30000);

  // ---- 8. Nested imports (import within an import) ----
  it('nested imports: handles imports within imported files', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      cssContent: [
        '@import "tailwindcss";',
        '@import "./components/index.css";',
      ].join('\n'),
      extraCSS: [
        {
          path: 'css/components/index.css',
          content: '@import "./button.css";\n@import "./badge.css";',
        },
        { path: 'css/components/button.css', content: '.nested-btn { color: blue; }' },
        { path: 'css/components/badge.css', content: '.nested-badge { color: green; }' },
      ],
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const css = await readFile(path.join(outDir, 'styles.css'), 'utf-8');
    expect(css).toContain('.nested-btn');
    expect(css).toContain('.nested-badge');
  }, 30000);

  // ---- 9. CSS at deeply nested input path ----
  it('deep input path: handles CSS source in deeply nested directory', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      cssPath: 'assets/styles/tailwind/main.css',
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    expect(existsSync(path.join(outDir, 'styles.css'))).toBe(true);
  }, 30000);

  // ---- 10. Debug mode produces output without errors ----
  it('debug mode: build succeeds with debug=true', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      debug: true,
    });
    tmpDirs.push(tmpDir);

    const { stderr } = await runBuild(tmpDir);

    expect(existsSync(path.join(outDir, 'styles.css'))).toBe(true);
    // Should not have error-level output
    expect(stderr || '').not.toContain('Error');
  }, 30000);

  // ---- 11. HTML template is also generated alongside CSS ----
  it('full build: both HTML and CSS are generated', async () => {
    const { tmpDir, outDir } = await scaffoldProject();
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    expect(existsSync(path.join(outDir, 'styles.css'))).toBe(true);
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(true);
  }, 30000);

  // ---- 12. Tailwind utility classes from HTML are included ----
  it('utility scanning: Tailwind utilities used in HTML appear in output CSS', async () => {
    const { tmpDir, outDir } = await scaffoldProject();
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const css = await readFile(path.join(outDir, 'styles.css'), 'utf-8');
    // The HTML template uses "text-red-500", Tailwind should include it
    // (Note: this depends on Tailwind scanning the HTML files — the @tailwindcss/postcss
    // plugin does content scanning automatically)
    expect(css).toContain('text-red-500');
  }, 30000);

  // ---- 13. Same input and output filename (user antipattern) ----
  it('same input/output name: works but input is the source, output is compiled', async () => {
    const { tmpDir, outDir } = await scaffoldProject({
      cssPath: 'css/styles.css',
      outputOption: 'css/styles.css',
    });
    tmpDirs.push(tmpDir);

    await runBuild(tmpDir);

    const cssFile = path.join(outDir, 'css', 'styles.css');
    expect(existsSync(cssFile)).toBe(true);

    const css = await readFile(cssFile, 'utf-8');
    expect(css.length).toBeGreaterThan(100);
  }, 30000);
});
