import postcss from 'postcss'
import tailwindCSS from '@tailwindcss/postcss'
import path from 'node:path';
import util from 'util'
import kleur from 'kleur';
import cssnano from "cssnano";
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Variables to improve logging
const nl = "\n"
const logPrefix = `${kleur.magenta(`[eleventy-plugin-tailwind-4] `)}`

const tailwindcss = (eleventyConfig, options) => {

  // set default options
  const defaultOptions = {
    output: 'styles.css', // the generated CSS file
    minify: false, // Should we minify the CSS
    watchOuput: true, // Should we watch the outpu folder for changes (almost certainly yes)
    debug: false, // Show detailed debug info
    domDiff: false, // Does the Dev Server do domDiffing — it causes a flash of unstyled content if you do.
    debugTruncationLength: 300 // truncate the output of the CSS when printed to the console when debugging. 
  }

  //merge defaltOptions with passed options
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

  // Run the Tailwind command in the before event handler.
  eleventyConfig.on("eleventy.before", async function () {
    if (!inputValid) return;

    let plugins = [tailwindCSS] // add tailwind plugin
    if (options.minify) {
      plugins.push(cssnano) // conditionally add cssnano for minification
    }

    const startTime = performance.now(); // log start time

    try {
      if (options.debug) {
        console.log(`${logPrefix + kleur.green(`eleventy.before — directories.output:`)} ${eleventyConfig.directories.output}`)
        console.log(`${logPrefix + kleur.green(`eleventy.before — writing to:`)} ${generatedCSSfile}`)
      }

      // Read the tailwind source file
      const css = await readFile(tailwindSourceFile);
      if (options.debug) {
        console.log(`${logPrefix + kleur.green(`Source CSS read from:`)} ${tailwindSourceFile}`)
      }

      // Run PostCSS with our plugins
      const result = await postcss(plugins)
        .process(css, {
          from: tailwindSourceFile,
          to: generatedCSSfile,
          map: { absolute: true }
        });

      // result.css contains our 'compiled' css
      if (options.debug) {
        console.log(`${logPrefix + kleur.green(`PostCSS generated your CSS:`)} ${nl}${result.css.substring(0, options.debugTruncationLength)}...`)
      }

      // Create the output folder if it doesn't already exist.
      // Required because PostCSS can complete before eleventy generates its first file.
      await mkdir(generatedCSSpath, { recursive: true });
      if (options.debug) {
        console.log(`${logPrefix + kleur.green(`Output directory:`)} ${generatedCSSpath} ${kleur.green(`exists or was created`)} `)
      }

      // Write our generated CSS out to file.
      await writeFile(generatedCSSfile, result.css);

      const endTime = performance.now() // log completion time

      // debug info
      if (options.debug) {
        console.log(`${logPrefix + kleur.green(`CSS written to:`)} ${generatedCSSfile}`)
        console.log(`${logPrefix + kleur.green(`Processing`)} TailwindCSS ${kleur.green(`took `) + (endTime - startTime).toFixed(2)} ms`)
      }

      // Print out success to the console with timings
      console.log(`${logPrefix + kleur.green(`Wrote `) + generatedCSSfile + kleur.green(` in `) + (endTime - startTime).toFixed(2)} ms`)

    } catch (err) {
      console.log(`${logPrefix + kleur.red().bold(`Error processing TailwindCSS:`)} ${nl}${err}`)
    }
  });

  eleventyConfig.setServerOptions({
    // control whether domDiffing is on or off
    // we turn it off by defaul as it causes a flash
    domDiff: options.domDiff,

    // Watch the output css file because eleventy isn't processing it. 
    watch: options.watchOuput ? [generatedCSSfile] : [],
  });

}
export default tailwindcss