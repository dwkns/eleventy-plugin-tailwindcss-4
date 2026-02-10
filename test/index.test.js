import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tailwindcss from '../index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock eleventyConfig object that records all calls.
 * The `_handlers` object captures event handlers registered via `on()`.
 *
 * Mirrors the real Eleventy config shape:
 *   - dir.input / dir.output  — legacy, does NOT reflect setOutputDirectory()
 *   - directories.input / directories.output — the resolved, canonical paths
 */
function createMockConfig(dirs = {}) {
  const handlers = {};
  return {
    dir: {
      input: dirs.input ?? 'src',
      output: dirs.output ?? '_site',
    },
    directories: {
      input: dirs.input ?? 'src',
      output: dirs.output ?? '_site',
    },
    addWatchTarget: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    setServerOptions: vi.fn(),
    _handlers: handlers,
  };
}

/**
 * Returns the eleventy.before handler registered on a mock config.
 */
function getBeforeHandler(config) {
  return config._handlers['eleventy.before'];
}

/**
 * Creates a temp directory with an input CSS file.
 * Symlinks node_modules so @import "tailwindcss" can resolve.
 * Returns { tmpDir, inputDir, outputDir, cssFile }.
 */
async function createTempFixture(cssContent = '.test { color: red; }') {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'etw-test-'));
  const inputDir = path.join(tmpDir, 'src');
  const outputDir = path.join(tmpDir, '_site');
  const cssDir = path.join(inputDir, 'css');
  const cssFile = path.join(cssDir, 'tailwind.css');
  await mkdir(cssDir, { recursive: true });
  await writeFile(cssFile, cssContent);
  // Symlink node_modules so PostCSS can resolve @import "tailwindcss"
  const projectRoot = path.resolve(import.meta.dirname, '..');
  await symlink(
    path.join(projectRoot, 'node_modules'),
    path.join(tmpDir, 'node_modules'),
    'junction'
  );
  return { tmpDir, inputDir, outputDir, cssFile };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('eleventy-plugin-tailwindcss-4', () => {

  // =========================================================================
  // Module export
  // =========================================================================
  describe('module export', () => {
    it('exports the plugin as a default function', () => {
      expect(typeof tailwindcss).toBe('function');
    });

    it('plugin function accepts two arguments (eleventyConfig, options)', () => {
      expect(tailwindcss.length).toBe(2);
    });
  });

  // =========================================================================
  // Option merging
  // =========================================================================
  describe('option merging', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('applies all default options when only input is provided', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css' });

      // Defaults: domDiff=true, watchOutput=true
      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({ domDiff: true })
      );
      // Default output is 'styles.css', watchOutput is true so it should be watched
      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: ['_site/styles.css'],
        })
      );
    });

    it('custom options override defaults', () => {
      const config = createMockConfig();
      tailwindcss(config, {
        input: 'css/tailwind.css',
        output: 'custom/output.css',
        domDiff: false,
        watchOutput: false,
      });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          domDiff: false,
          watch: [],
        })
      );
    });

    it('partial custom options merge with defaults (unspecified options keep defaults)', () => {
      const config = createMockConfig();
      tailwindcss(config, {
        input: 'css/tailwind.css',
        minify: true,
        // output, watchOutput, domDiff, debug should all keep defaults
      });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          domDiff: true, // default
          watch: ['_site/styles.css'], // default output, default watchOutput=true
        })
      );
    });
  });

  // =========================================================================
  // Path construction
  // =========================================================================
  describe('path construction', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('constructs source path from eleventyConfig.dir.input + options.input', () => {
      const config = createMockConfig({ input: 'src', output: '_site' });
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.addWatchTarget).toHaveBeenCalledWith('src/css/tailwind.css');
    });

    it('constructs output path from eleventyConfig.directories.output + options.output', () => {
      const config = createMockConfig({ input: 'src', output: '_site' });
      tailwindcss(config, { input: 'css/tailwind.css', output: 'css/styles.css' });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: ['_site/css/styles.css'],
        })
      );
    });

    it('uses default output name "styles.css" when output is not specified', () => {
      const config = createMockConfig({ input: 'src', output: '_site' });
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: ['_site/styles.css'],
        })
      );
    });

    it('handles deeply nested input and output paths', () => {
      const config = createMockConfig({ input: 'project/src', output: 'project/dist' });
      tailwindcss(config, { input: 'assets/css/main.css', output: 'assets/css/compiled.css' });

      expect(config.addWatchTarget).toHaveBeenCalledWith('project/src/assets/css/main.css');
      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: ['project/dist/assets/css/compiled.css'],
        })
      );
    });
  });

  // =========================================================================
  // Input validation
  // =========================================================================
  describe('input validation', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('logs "No input file supplied" when input option is undefined', () => {
      const config = createMockConfig();
      tailwindcss(config, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No input file supplied')
      );
    });

    it('logs guidance to include an input option when input is undefined', () => {
      const config = createMockConfig();
      tailwindcss(config, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("input: 'path/to/tailwind.css'")
      );
    });

    it('logs "cannot be found" when input file does not exist', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'nonexistent/file.css' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot be found')
      );
    });

    it('includes the file path in the "cannot be found" warning', () => {
      const config = createMockConfig({ input: 'src' });
      tailwindcss(config, { input: 'nonexistent/file.css' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/nonexistent/file.css')
      );
    });

    it('logs that CSS will not be compiled when input is invalid', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'nonexistent/file.css' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not')
      );
    });

    it('does not log warnings when input file exists', async () => {
      const { tmpDir, inputDir } = await createTempFixture();

      try {
        const config = createMockConfig({ input: inputDir, output: path.join(tmpDir, '_site') });
        tailwindcss(config, { input: 'css/tailwind.css' });

        const warningCalls = consoleSpy.mock.calls.filter(
          call => typeof call[0] === 'string' &&
            (call[0].includes('Warning') || call[0].includes('No input file'))
        );
        expect(warningCalls).toHaveLength(0);
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    });
  });

  // =========================================================================
  // Watch target registration
  // =========================================================================
  describe('watch target registration', () => {
    let consoleSpy;
    let tmpDir;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(async () => {
      consoleSpy.mockRestore();
      if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true });
        tmpDir = null;
      }
    });

    it('calls addWatchTarget with the source file path', () => {
      // Use a non-existent input dir so resolveImports doesn't find real files
      const config = createMockConfig({ input: 'mock-src', output: '_site' });
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.addWatchTarget).toHaveBeenCalledTimes(1);
      expect(config.addWatchTarget).toHaveBeenCalledWith('mock-src/css/tailwind.css');
    });

    it('calls addWatchTarget even when the input file does not exist', () => {
      const config = createMockConfig({ input: 'mock-src', output: '_site' });
      tailwindcss(config, { input: 'nonexistent.css' });

      expect(config.addWatchTarget).toHaveBeenCalledTimes(1);
      expect(config.addWatchTarget).toHaveBeenCalledWith('mock-src/nonexistent.css');
    });

    it('calls addWatchTarget for each @import-ed CSS file (as relative paths)', async () => {
      const fixture = await createTempFixture(
        '@import "./components/button.css";\n.body { color: red; }'
      );
      tmpDir = fixture.tmpDir;

      // Create the imported file
      const componentsDir = path.join(path.dirname(fixture.cssFile), 'components');
      await mkdir(componentsDir, { recursive: true });
      const buttonFile = path.join(componentsDir, 'button.css');
      await writeFile(buttonFile, '.btn { color: blue; }');

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      // Should be called for source file + imported file
      expect(config.addWatchTarget).toHaveBeenCalledTimes(2);
      expect(config.addWatchTarget).toHaveBeenCalledWith(
        path.join(fixture.inputDir, 'css/tailwind.css')
      );
      // Imported file paths are converted to relative paths for Eleventy's watcher
      const expectedRelative = path.relative(process.cwd(), buttonFile);
      expect(config.addWatchTarget).toHaveBeenCalledWith(expectedRelative);
    });

    it('does not watch imports when watchImports is false', async () => {
      const fixture = await createTempFixture(
        '@import "./components/button.css";\n.body { color: red; }'
      );
      tmpDir = fixture.tmpDir;

      // Create the imported file
      const componentsDir = path.join(path.dirname(fixture.cssFile), 'components');
      await mkdir(componentsDir, { recursive: true });
      await writeFile(path.join(componentsDir, 'button.css'), '.btn {}');

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', watchImports: false });

      // Only the source file, not the imported file
      expect(config.addWatchTarget).toHaveBeenCalledTimes(1);
      expect(config.addWatchTarget).toHaveBeenCalledWith(
        path.join(fixture.inputDir, 'css/tailwind.css')
      );
    });

    it('logs imported file count in debug mode', async () => {
      const fixture = await createTempFixture(
        '@import "./components/button.css";'
      );
      tmpDir = fixture.tmpDir;

      const componentsDir = path.join(path.dirname(fixture.cssFile), 'components');
      await mkdir(componentsDir, { recursive: true });
      await writeFile(path.join(componentsDir, 'button.css'), '.btn {}');

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', debug: true });

      const watchingCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Watching imported file')
      );
      expect(watchingCall).toBeDefined();

      const totalCall = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Total imported files watched')
      );
      expect(totalCall).toBeDefined();
      expect(totalCall[0]).toContain('1');
    });
  });

  // =========================================================================
  // Event registration
  // =========================================================================
  describe('event registration', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('registers an eleventy.before event handler', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.on).toHaveBeenCalledTimes(1);
      expect(config.on).toHaveBeenCalledWith('eleventy.before', expect.any(Function));
    });

    it('the registered handler is an async function', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css' });

      const handler = getBeforeHandler(config);
      // AsyncFunction constructor name
      expect(handler.constructor.name).toBe('AsyncFunction');
    });
  });

  // =========================================================================
  // Server options
  // =========================================================================
  describe('server options', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('calls setServerOptions exactly once', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.setServerOptions).toHaveBeenCalledTimes(1);
    });

    it('sets domDiff to true by default', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({ domDiff: true })
      );
    });

    it('sets domDiff to false when specified in options', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css', domDiff: false });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({ domDiff: false })
      );
    });

    it('watches the generated CSS file by default (watchOutput: true)', () => {
      const config = createMockConfig({ input: 'src', output: '_site' });
      tailwindcss(config, { input: 'css/tailwind.css' });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: ['_site/styles.css'],
        })
      );
    });

    it('does not watch the generated CSS file when watchOutput is false', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css', watchOutput: false });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: [],
        })
      );
    });

    it('watches custom output path when output option is specified', () => {
      const config = createMockConfig({ input: 'src', output: 'dist' });
      tailwindcss(config, { input: 'css/tailwind.css', output: 'assets/main.css' });

      expect(config.setServerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          watch: ['dist/assets/main.css'],
        })
      );
    });
  });

  // =========================================================================
  // CSS processing (eleventy.before handler)
  // =========================================================================
  describe('CSS processing (eleventy.before handler)', () => {
    let consoleSpy;
    let tmpDir;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(async () => {
      consoleSpy.mockRestore();
      if (tmpDir) {
        await rm(tmpDir, { recursive: true });
        tmpDir = null;
      }
    });

    it('processes simple CSS and writes an output file', async () => {
      const fixture = await createTempFixture('.hello { color: blue; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      await getBeforeHandler(config)();

      const outputFile = path.join(fixture.outputDir, 'styles.css');
      expect(existsSync(outputFile)).toBe(true);

      const output = await readFile(outputFile, 'utf-8');
      expect(output).toContain('.hello');
      expect(output).toContain('color');
    });

    it('processes Tailwind CSS directives and produces utility CSS', async () => {
      const fixture = await createTempFixture('@import "tailwindcss";');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      await getBeforeHandler(config)();

      const outputFile = path.join(fixture.outputDir, 'styles.css');
      expect(existsSync(outputFile)).toBe(true);

      const output = await readFile(outputFile, 'utf-8');
      // Tailwind base should produce substantial CSS
      expect(output.length).toBeGreaterThan(100);
    }, 30000);

    it('creates the output directory if it does not exist', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      // Use a deeply nested output path that doesn't exist yet
      const deepOutput = path.join(fixture.tmpDir, 'deep', 'nested', 'output');
      const config = createMockConfig({ input: fixture.inputDir, output: deepOutput });
      tailwindcss(config, { input: 'css/tailwind.css' });

      await getBeforeHandler(config)();

      expect(existsSync(path.join(deepOutput, 'styles.css'))).toBe(true);
    });

    it('writes to a custom output path', async () => {
      const fixture = await createTempFixture('.test { color: green; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', output: 'assets/css/compiled.css' });

      await getBeforeHandler(config)();

      const outputFile = path.join(fixture.outputDir, 'assets', 'css', 'compiled.css');
      expect(existsSync(outputFile)).toBe(true);

      const output = await readFile(outputFile, 'utf-8');
      expect(output).toContain('.test');
    });

    it('minifies CSS output when minify option is true', async () => {
      const fixture = await createTempFixture('@import "tailwindcss";');
      tmpDir = fixture.tmpDir;

      // Get unminified output
      const config1 = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config1, { input: 'css/tailwind.css', minify: false });
      await getBeforeHandler(config1)();
      const unminified = await readFile(path.join(fixture.outputDir, 'styles.css'), 'utf-8');

      // Get minified output
      const outputDir2 = path.join(fixture.tmpDir, '_site_minified');
      const config2 = createMockConfig({ input: fixture.inputDir, output: outputDir2 });
      tailwindcss(config2, { input: 'css/tailwind.css', minify: true });
      await getBeforeHandler(config2)();
      const minified = await readFile(path.join(outputDir2, 'styles.css'), 'utf-8');

      // Minified should be meaningfully shorter
      expect(minified.length).toBeLessThan(unminified.length);
      // Minified should have fewer newlines
      expect(minified.split('\n').length).toBeLessThan(unminified.split('\n').length);
    }, 60000);

    it('returns early without writing when input file is invalid', async () => {
      tmpDir = (await mkdtemp(path.join(tmpdir(), 'etw-test-'))); // need tmpDir for cleanup
      const outputDir = path.join(tmpDir, '_site');

      const config = createMockConfig({ input: path.join(tmpDir, 'src'), output: outputDir });
      tailwindcss(config, { input: 'nonexistent.css' });

      await getBeforeHandler(config)();

      // Output directory should not have been created
      expect(existsSync(outputDir)).toBe(false);
    });

    it('catches PostCSS errors and logs them without throwing', async () => {
      // Create a CSS file that imports a nonexistent local file
      const fixture = await createTempFixture('@import "./does-not-exist.css";');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      // Should not throw — errors are caught internally
      await expect(getBeforeHandler(config)()).resolves.not.toThrow();

      // Should have logged an error message
      const errorCalls = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Error')
      );
      expect(errorCalls.length).toBeGreaterThan(0);
    });

    it('logs a success message with timing after processing', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      await getBeforeHandler(config)();

      const wroteCalls = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Wrote')
      );
      expect(wroteCalls.length).toBe(1);
      // Should contain timing in ms
      expect(wroteCalls[0][0]).toContain('ms');
    });

    it('includes source map comment in output', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      await getBeforeHandler(config)();

      const output = await readFile(path.join(fixture.outputDir, 'styles.css'), 'utf-8');
      // PostCSS with map: { absolute: true } should include a sourceMappingURL
      expect(output).toContain('sourceMappingURL');
    });

    it('can be called multiple times (simulating multiple builds)', async () => {
      const fixture = await createTempFixture('.first { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css' });

      const handler = getBeforeHandler(config);

      // First build
      await handler();
      const output1 = await readFile(path.join(fixture.outputDir, 'styles.css'), 'utf-8');
      expect(output1).toContain('.first');

      // Modify the source file
      await writeFile(fixture.cssFile, '.second { color: blue; }');

      // Second build
      await handler();
      const output2 = await readFile(path.join(fixture.outputDir, 'styles.css'), 'utf-8');
      expect(output2).toContain('.second');
    });

  });

  // =========================================================================
  // Debug logging
  // =========================================================================
  describe('debug logging', () => {
    let consoleSpy;
    let tmpDir;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(async () => {
      consoleSpy.mockRestore();
      if (tmpDir) {
        await rm(tmpDir, { recursive: true });
        tmpDir = null;
      }
    });

    it('logs startup options when debug is true', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', debug: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting with options')
      );
    });

    it('logs source file path when debug is true', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', debug: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TailwindCSS source file')
      );
    });

    it('logs generated CSS file path when debug is true', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', debug: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generated CSS file')
      );
    });

    it('logs output path when debug is true', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', debug: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Output path')
      );
    });

    it('does NOT log any debug messages when debug is false', () => {
      const config = createMockConfig();
      tailwindcss(config, { input: 'css/tailwind.css', debug: false });

      // Only warning messages about missing file should appear, not debug messages
      const debugCalls = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' &&
          (call[0].includes('Starting with options') ||
           call[0].includes('TailwindCSS source file') ||
           call[0].includes('Generated CSS file') ||
           call[0].includes('Output path'))
      );
      expect(debugCalls).toHaveLength(0);
    });

    it('does NOT log debug messages inside eleventy.before when debug is false', async () => {
      const fixture = await createTempFixture('.test { color: red; }');
      tmpDir = fixture.tmpDir;

      const config = createMockConfig({ input: fixture.inputDir, output: fixture.outputDir });
      tailwindcss(config, { input: 'css/tailwind.css', debug: false });

      // Clear init-time logs, then run the handler
      consoleSpy.mockClear();
      await getBeforeHandler(config)();

      // Only the "Wrote" success message should appear (always logged, not debug-only)
      const calls = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('[eleventy-plugin-tailwind-4]')
      );
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toContain('Wrote');
    });
  });
});
