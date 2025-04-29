import postcss from 'postcss'
import tailwindCSS from '@tailwindcss/postcss'
import fs from 'fs'
import path from 'node:path';
import util from 'util'
import kleur from 'kleur';
import cssnano from "cssnano";

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

  // create the correct paths including eleventy input/output folders.
  const tailwindSourceFile = `${eleventyConfig.dir.input}/${options.input}`
  const generatedCSSfile = `${eleventyConfig.dir.output}/${options.output}`

  const generatedCSSpath = path.dirname(generatedCSSfile);

  if (options.debug) {
    console.log(`${logPrefix + kleur.green(`TailwindCSS source file:`)} ${tailwindSourceFile}`)
    console.log(`${logPrefix + kleur.green(`Generated CSS file:`)} ${generatedCSSfile}`)
    console.log(`${logPrefix + kleur.green(`Output path:`)} ${generatedCSSpath}`)
  }

  // Check inputCSS is valid
  const inputValid = fs.existsSync(tailwindSourceFile)

  if (inputValid) {
    if (options.debug) {
      // this doesn't make sense anymore.
      // console.log(`${logPrefix} ${green}Running ${reset}${execSyncString}`);
    }
  } else {
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

    let plugins = [tailwindCSS] // add tailwind plugin
    if (options.minify) {
      plugins.push(cssnano) // conditionally add cssnano for minification
    }

    var startTime = performance.now(); // log start time


    if (inputValid) {
      // If we have a valid input file read the tailwind source file
      fs.readFile(tailwindSourceFile, (err, css) => {
        if (options.debug) {
          console.log(`${logPrefix + kleur.green(`Source CSS read from:`)}${tailwindSourceFile}`)
        }
        // Run PostCSS with our plugins
        postcss(plugins)
          .process(css, { from: tailwindSourceFile, to: generatedCSSfile })
          .then(result => {

            // result.css contains our 'compiled' css
            if (options.debug) {
              console.log(`${logPrefix + kleur.green(`PostCSS generated your CSS:`)} ${nl}${result.css.substring(0, options.debugTruncationLength)}...`)
            }

            // Create the output folder if it doesn't already exist.
            // Required because this PostCSS can complete before eleventy generates it's first file.  
            fs.mkdir(generatedCSSpath, { recursive: true }, (err) => {
              if (err) {
                console.log(`${logPrefix + kleur.red().bold(`An error occured creating the output folder (error):`)} ${nl}${err}`)




              } else {
                // debug info
                if (options.debug) {
                  console.log(`${logPrefix + kleur.green(`Output directory:`)} ${generatedCSSpath} ${kleur.green(`exists or was created`)} `)
                }

                // Write our generated CSS out to file.
                fs.writeFile(generatedCSSfile, result.css, err => {
                  if (err) {
                    console.log(`${logPrefix + kleur.red().bold(`An error occured writing the outputfile (error):`)} ${nl}${err}`)
                  } else {
                    const endTime = performance.now() // log completion time

                    // debug info
                    if (options.debug) {
                      console.log(`${logPrefix + kleur.green(`CSS written to:`)} ${generatedCSSfile}`)
                      console.log(`${logPrefix + kleur.green(`Processing`)} TailwindCSS ${kleur.green(`took `) + (endTime - startTime).toFixed(2)} ms`)
                    }

                    // Print out success to the console with timings
                    console.log(`${logPrefix + kleur.green(`Wrote `) + generatedCSSfile + kleur.green(` in `) + (endTime - startTime).toFixed(2)} ms`)

                  }
                });

              }
            });




          })
      })

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