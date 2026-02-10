import postcss from 'postcss'
import tailwindCSS from '@tailwindcss/postcss'
import path from 'node:path';
import util from 'util'
import kleur from 'kleur';
import cssnano from "cssnano";
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolveImports } from './lib/resolveImports.js';

// Variables to improve logging
const nl = "\n"
const logPrefix = `${kleur.magenta(`[eleventy-plugin-tailwind-4] `)}`

const tailwindcss = (eleventyConfig, options) => {

  // set default options
  const defaultOptions = {
    output: 'styles.css', // the generated CSS file
    minify: false, // Should we minify the CSS
    watchOutput: true, // Should we watch the output folder for changes (almost certainly yes)
    debug: false, // Show detailed debug info
    domDiff: true, // Enable Dev Server domDiffing. Set to false if you experience unstyled content flashes.
    watchImports: true, // Watch @import-ed CSS files for changes (Issue #4)
    sourceMap: false, // false = no sourcemap, true = external .map file, 'inline' = embedded in CSS
  }

  // Merge default options with passed options.
  options = { ...defaultOptions, ...options }

  // Start up message
  if (options.debug) {
    console.log(`${logPrefix}${kleur.green(`Starting with options:`) + nl + util.inspect(options, { colors: true, compact: false, depth: 5, breakLength: 80 })} `)
  }

  // Create the correct paths including eleventy input/output folders.
  // Use path.join() to normalise slashes (e.g. directories.output may have a trailing slash).
  // options.input may be undefined if the user forgot to set it, so guard with null.
  const tailwindSourceFile = options.input
    ? path.join(eleventyConfig.dir.input, options.input)
    : null

  // Use eleventyConfig.directories.output as the definitive output path.
  // eleventyConfig.dir.output does not reflect setOutputDirectory() calls.
  const generatedCSSfile = path.join(eleventyConfig.directories.output, options.output)

  const generatedCSSpath = path.dirname(generatedCSSfile);

  if (options.debug) {
    console.log(`${logPrefix + kleur.green(`Eleventy directories.output:`)} ${eleventyConfig.directories.output}`)
    console.log(`${logPrefix + kleur.green(`TailwindCSS source file:`)} ${tailwindSourceFile}`)
    console.log(`${logPrefix + kleur.green(`Generated CSS file:`)} ${generatedCSSfile}`)
    console.log(`${logPrefix + kleur.green(`Output path:`)} ${generatedCSSpath}`)
  }

  // Check inputCSS is valid.
  // tailwindSourceFile is null when options.input was not provided.
  const inputValid = tailwindSourceFile && existsSync(tailwindSourceFile)

  if (!inputValid) {
    if (options.input == undefined) {
      console.log(`${logPrefix + kleur.red().bold(`Warning:`)} No input file supplied.`)
      console.log(`${logPrefix}Include ${kleur.yellow(`{ input: 'path/to/tailwind.css' }`)} in options.`)
    } else {
      console.log(`${logPrefix + kleur.red().bold(`Warning:`)} Your input file ${kleur.yellow(`${tailwindSourceFile}`)} cannot be found.`)
    }
    console.log(`${logPrefix}Your Tailwind CSS will ${kleur.red().bold(`not`)} be compiled.`)
  }

  // Make sure we watch the source file for changes.
  // CSS is not watched by default in eleventy
  eleventyConfig.addWatchTarget(tailwindSourceFile);

  // Discover and watch @import-ed CSS files so changes to them trigger rebuilds (Issue #4).
  // Only runs when the input file is valid and watchImports is enabled.
  if (inputValid && options.watchImports) {
    const sourceDir = path.dirname(path.resolve(tailwindSourceFile));
    const rel = (p) => path.relative(sourceDir, p);
    const importLogger = options.debug ? {
      onSkipBare: (p) => console.log(`${logPrefix + kleur.yellow(`Skipping wath of bare module import:`)} ${p}`),
      onSkipNotFound: (p) => console.log(`${logPrefix + kleur.yellow(`Imported file not found, skipping:`)} ${rel(p)}`),
      onWatch: (p) => console.log(`${logPrefix + kleur.green(`Watching imported file:`)} ${rel(p)}`),
    } : {};

    const importedFiles = resolveImports(tailwindSourceFile, importLogger);
    for (const file of importedFiles) {
      // Convert absolute paths from resolveImports to relative paths.
      // Eleventy's watcher expects paths relative to the project root (like ./src/css/file.css).
      const relativePath = path.relative(process.cwd(), file);
      eleventyConfig.addWatchTarget(relativePath);
    }
    if (options.debug) {
      console.log(`${logPrefix + kleur.green(`Total imported files watched:`)} ${importedFiles.length}`)
    }
  }

  if (options.debug) {
    console.log(`${logPrefix + kleur.green(`additionalWatchTargets:`)} ${nl}${util.inspect(eleventyConfig.additionalWatchTargets, { colors: true, compact: false })}`)
  }

  // Run the Tailwind command in the before event handler.
  eleventyConfig.on("eleventy.before", async function () {
    if (!inputValid) return;

    let plugins = [tailwindCSS] // add tailwind plugin
    if (options.minify) {
      plugins.push(cssnano) // conditionally add cssnano for minification
    }

    const startTime = performance.now(); // log start time

    try {
      // Read the tailwind source file
      const css = await readFile(tailwindSourceFile);

      // Derive PostCSS map option from sourceMap setting
      const mapOption = options.sourceMap === true
        ? { inline: false }       // external .map file
        : options.sourceMap === 'inline'
          ? { inline: true }      // embedded in CSS
          : false;                // no sourcemap

      // Run PostCSS with our plugins
      const result = await postcss(plugins)
        .process(css, {
          from: tailwindSourceFile,
          to: generatedCSSfile,
          map: mapOption
        });

      // Create the output folder if it doesn't already exist.
      // Required because PostCSS can complete before eleventy generates its first file.
      await mkdir(generatedCSSpath, { recursive: true });

      // Write our generated CSS out to file.
      await writeFile(generatedCSSfile, result.css);

      // Write external sourcemap file when sourceMap is true (not inline, not false)
      if (options.sourceMap === true && result.map) {
        await writeFile(generatedCSSfile + '.map', result.map.toString());
      }

      const endTime = performance.now() // log completion time

      // Print out success to the console with timings
      console.log(`${logPrefix + kleur.green(`Wrote `) + generatedCSSfile + kleur.green(` in `) + (endTime - startTime).toFixed(2)} ms`)

    } catch (err) {
      console.log(`${logPrefix + kleur.red().bold(`Error processing TailwindCSS:`)} ${nl}${err}`)
    }
  });

  eleventyConfig.setServerOptions({
    // Enable or disable Dev Server domDiffing.
    domDiff: options.domDiff,

    // Watch the output css file because eleventy isn't processing it. 
    watch: options.watchOutput ? [generatedCSSfile] : [],
  });

}
export default tailwindcss