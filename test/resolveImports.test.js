import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveImports } from '../lib/resolveImports.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a temp directory with the given file structure.
 * files is an object: { 'relative/path.css': 'content', ... }
 */
async function createFixture(files) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'resolve-imports-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, relPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
  return tmpDir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveImports', () => {
  let tmpDir;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  // =========================================================================
  // Basic resolution
  // =========================================================================

  it('returns an empty array for a file with no imports', async () => {
    tmpDir = await createFixture({
      'main.css': '.body { color: red; }',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([]);
  });

  it('discovers a relative import with ./ prefix', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "./button.css";',
      'button.css': '.btn { color: blue; }',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([path.join(tmpDir, 'button.css')]);
  });

  it('discovers a relative import without ./ prefix (has file extension)', async () => {
    tmpDir = await createFixture({
      'css/main.css': '@import "components/card.css";',
      'css/components/card.css': '.card { display: flex; }',
    });
    const result = resolveImports(path.join(tmpDir, 'css/main.css'));
    expect(result).toEqual([path.join(tmpDir, 'css/components/card.css')]);
  });

  it('discovers a relative import with ../ prefix', async () => {
    tmpDir = await createFixture({
      'css/main.css': '@import "../shared/reset.css";',
      'shared/reset.css': '* { margin: 0; }',
    });
    const result = resolveImports(path.join(tmpDir, 'css/main.css'));
    expect(result).toEqual([path.join(tmpDir, 'shared/reset.css')]);
  });

  it('handles single-quoted imports', async () => {
    tmpDir = await createFixture({
      'main.css': "@import './button.css';",
      'button.css': '.btn { color: blue; }',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([path.join(tmpDir, 'button.css')]);
  });

  it('discovers multiple imports from one file', async () => {
    tmpDir = await createFixture({
      'main.css': [
        '@import "./a.css";',
        '@import "./b.css";',
        '@import "./c.css";',
      ].join('\n'),
      'a.css': '.a {}',
      'b.css': '.b {}',
      'c.css': '.c {}',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([
      path.join(tmpDir, 'a.css'),
      path.join(tmpDir, 'b.css'),
      path.join(tmpDir, 'c.css'),
    ]);
  });

  // =========================================================================
  // Skipping bare module imports
  // =========================================================================

  it('skips bare module imports with no file extension', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "tailwindcss";',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([]);
  });

  it('skips bare module imports with a slash but no extension', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "open-props/normalize";',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([]);
  });

  it('resolves imports with no ./ prefix but with a file extension', async () => {
    tmpDir = await createFixture({
      'main.css': [
        '@import "tailwindcss";',
        '@import "components/button.css";',
      ].join('\n'),
      'components/button.css': '.btn {}',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([path.join(tmpDir, 'components/button.css')]);
  });

  // =========================================================================
  // Skipping url() imports
  // =========================================================================

  it('skips @import url("...") imports', async () => {
    tmpDir = await createFixture({
      'main.css': '@import url("https://fonts.example.com/font.css");',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([]);
  });

  it('skips @import url(\'...\') imports with single quotes', async () => {
    tmpDir = await createFixture({
      'main.css': "@import url('https://fonts.example.com/font.css');",
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([]);
  });

  // =========================================================================
  // Ignoring @import inside CSS comments
  // =========================================================================

  it('ignores @import statements inside CSS comments', async () => {
    tmpDir = await createFixture({
      'main.css': '/* example: @import "phantom.css" */\n@import "./real.css";',
      'real.css': '.real {}',
    });
    const onSkipNotFound = vi.fn();
    const result = resolveImports(path.join(tmpDir, 'main.css'), { onSkipNotFound });
    expect(result).toEqual([path.join(tmpDir, 'real.css')]);
    // The commented-out import should NOT trigger onSkipNotFound
    expect(onSkipNotFound).not.toHaveBeenCalled();
  });

  it('ignores @import inside multi-line CSS comments', async () => {
    tmpDir = await createFixture({
      'main.css': [
        '/*',
        ' * @import "commented-out.css";',
        ' */',
        '@import "./real.css";',
      ].join('\n'),
      'real.css': '.real {}',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([path.join(tmpDir, 'real.css')]);
  });

  // =========================================================================
  // Nested / recursive imports
  // =========================================================================

  it('recursively discovers nested imports', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "./components/button.css";',
      'components/button.css': '@import "./badge.css";',
      'components/badge.css': '.badge { color: green; }',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([
      path.join(tmpDir, 'components/button.css'),
      path.join(tmpDir, 'components/badge.css'),
    ]);
  });

  it('handles deeply nested imports (3 levels)', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "./level1.css";',
      'level1.css': '@import "./sub/level2.css";',
      'sub/level2.css': '@import "./deep/level3.css";',
      'sub/deep/level3.css': '.deep { color: purple; }',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([
      path.join(tmpDir, 'level1.css'),
      path.join(tmpDir, 'sub/level2.css'),
      path.join(tmpDir, 'sub/deep/level3.css'),
    ]);
  });

  // =========================================================================
  // Circular imports
  // =========================================================================

  it('handles circular imports without infinite loop', async () => {
    tmpDir = await createFixture({
      'a.css': '@import "./b.css";',
      'b.css': '@import "./a.css";',
    });
    const result = resolveImports(path.join(tmpDir, 'a.css'));
    // a.css -> b.css (b.css tries to import a.css but it's already seen)
    expect(result).toEqual([path.join(tmpDir, 'b.css')]);
  });

  it('handles a three-way circular import', async () => {
    tmpDir = await createFixture({
      'a.css': '@import "./b.css";',
      'b.css': '@import "./c.css";',
      'c.css': '@import "./a.css";',
    });
    const result = resolveImports(path.join(tmpDir, 'a.css'));
    expect(result).toEqual([
      path.join(tmpDir, 'b.css'),
      path.join(tmpDir, 'c.css'),
    ]);
  });

  // =========================================================================
  // Missing / nonexistent files
  // =========================================================================

  it('returns empty array for a nonexistent file', () => {
    const result = resolveImports('/nonexistent/path/file.css');
    expect(result).toEqual([]);
  });

  it('skips imports that reference nonexistent files', async () => {
    tmpDir = await createFixture({
      'main.css': [
        '@import "./exists.css";',
        '@import "./missing.css";',
      ].join('\n'),
      'exists.css': '.exists {}',
    });
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([path.join(tmpDir, 'exists.css')]);
  });

  // =========================================================================
  // Logger callbacks
  // =========================================================================

  it('calls onWatch for each discovered import', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "./a.css";',
      'a.css': '.a {}',
    });
    const onWatch = vi.fn();
    resolveImports(path.join(tmpDir, 'main.css'), { onWatch });
    expect(onWatch).toHaveBeenCalledTimes(1);
    expect(onWatch).toHaveBeenCalledWith(path.join(tmpDir, 'a.css'));
  });

  it('calls onSkipBare for bare module imports', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "tailwindcss";\n@import "open-props/normalize";',
    });
    const onSkipBare = vi.fn();
    resolveImports(path.join(tmpDir, 'main.css'), { onSkipBare });
    expect(onSkipBare).toHaveBeenCalledTimes(2);
    expect(onSkipBare).toHaveBeenCalledWith('tailwindcss');
    expect(onSkipBare).toHaveBeenCalledWith('open-props/normalize');
  });

  it('calls onSkipNotFound for imports pointing to missing files', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "./missing.css";',
    });
    const onSkipNotFound = vi.fn();
    resolveImports(path.join(tmpDir, 'main.css'), { onSkipNotFound });
    expect(onSkipNotFound).toHaveBeenCalledTimes(1);
    expect(onSkipNotFound).toHaveBeenCalledWith(path.join(tmpDir, 'missing.css'));
  });

  it('calls all logger callbacks in a mixed file', async () => {
    tmpDir = await createFixture({
      'main.css': [
        '@import "tailwindcss";',
        '@import "./exists.css";',
        '@import "./missing.css";',
        '@import url("https://example.com/font.css");',
      ].join('\n'),
      'exists.css': '.exists {}',
    });
    const logger = {
      onSkipBare: vi.fn(),
      onSkipNotFound: vi.fn(),
      onWatch: vi.fn(),
    };
    resolveImports(path.join(tmpDir, 'main.css'), logger);

    expect(logger.onSkipBare).toHaveBeenCalledWith('tailwindcss');
    expect(logger.onWatch).toHaveBeenCalledWith(path.join(tmpDir, 'exists.css'));
    expect(logger.onSkipNotFound).toHaveBeenCalledWith(path.join(tmpDir, 'missing.css'));
    // url() import should not trigger any callback (filtered by regex)
    expect(logger.onSkipBare).toHaveBeenCalledTimes(1);
    expect(logger.onWatch).toHaveBeenCalledTimes(1);
    expect(logger.onSkipNotFound).toHaveBeenCalledTimes(1);
  });

  it('works without any logger (default empty object)', async () => {
    tmpDir = await createFixture({
      'main.css': '@import "tailwindcss";\n@import "./a.css";',
      'a.css': '.a {}',
    });
    // Should not throw
    const result = resolveImports(path.join(tmpDir, 'main.css'));
    expect(result).toEqual([path.join(tmpDir, 'a.css')]);
  });

  // =========================================================================
  // Mixed real-world scenario
  // =========================================================================

  it('handles a realistic import tree with all import types', async () => {
    tmpDir = await createFixture({
      'css/tailwind.css': [
        '@import "tailwindcss";',
        '@import "./components/button.css";',
        '@import "components/card.css";',
        '@import "../shared/reset.css";',
        '@import url("https://fonts.example.com/font.css");',
      ].join('\n'),
      'css/components/button.css': '@import "./badge.css";\n.btn { color: blue; }',
      'css/components/badge.css': '.badge { color: green; }',
      'css/components/card.css': '.card { display: flex; }',
      'shared/reset.css': '* { margin: 0; padding: 0; }',
    });

    const logger = {
      onSkipBare: vi.fn(),
      onSkipNotFound: vi.fn(),
      onWatch: vi.fn(),
    };

    const result = resolveImports(path.join(tmpDir, 'css/tailwind.css'), logger);

    // Should find: button.css, badge.css (nested), card.css, reset.css
    expect(result).toEqual([
      path.join(tmpDir, 'css/components/button.css'),
      path.join(tmpDir, 'css/components/badge.css'),
      path.join(tmpDir, 'css/components/card.css'),
      path.join(tmpDir, 'shared/reset.css'),
    ]);

    // Should skip: tailwindcss (bare module), url() import
    expect(logger.onSkipBare).toHaveBeenCalledWith('tailwindcss');
    expect(logger.onSkipBare).toHaveBeenCalledTimes(1);
    expect(logger.onWatch).toHaveBeenCalledTimes(4);
    expect(logger.onSkipNotFound).not.toHaveBeenCalled();
  });
});
