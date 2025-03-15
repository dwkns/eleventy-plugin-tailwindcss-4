'use strict';

var child_process = require('child_process');
var fs = require('fs');

const tailwindcss = (eleventyConfig, options) => {

  // set default options
  const defaultOptions = {
    output: 'styles.css',
    minify: false,
    watchOuput: true,
    debug: false
  };

  //merge defaltOptions with passed options
  options = { ...defaultOptions, ...options };

  // Set some log colours
  const red = "\x1b[31m";
  const green = "\x1b[32m";
  const yellow = "\x1b[33m";
  const pink = "\x1b[38;5;206m";
  const reset = "\x1b[0m";

  // Show/hide debug output
  const debugString = options.debug ? "DEBUG=1" : "";

  // Add minification flags to cli command
  let flags = options.minify ? "--minify" : "";

  // create the correct paths including eleventy input/output folders.
  const source = `${eleventyConfig.dir.input}/${options.input}`;
  const generated = `${eleventyConfig.dir.output}/${options.output}`;


  // generate the command we are going to run
  const execSyncString = `${debugString} npx @tailwindcss/cli -i ./${source} -o ${generated} ${flags}`;


  // Check inputCSS is valid
  const inputValid = fs.existsSync(source);

  if (inputValid) {
    if (options.debug) {
      console.log(`${pink}[eleventy-plugin-tailwind-4] ${green}Running ${reset}${execSyncString}`);
    }
  } else {
    if (options.input == undefined) {
      console.log(`${pink}[eleventy-plugin-tailwind-4] ${red}Warning:${reset} No input file supplied.`);
      console.log(`${pink}[eleventy-plugin-tailwind-4] ${reset}Include ${yellow}{ input: 'path/to/tailwind.css'}${reset} in options.`);
    } else {
      console.log(`${pink}[eleventy-plugin-tailwind-4] ${red}Warning:${reset} your input file ${yellow}./${source} ${reset}cannot be found.`);

    }

    console.log(`${pink}[eleventy-plugin-tailwind-4]${reset} Your Tailwind CSS will ${red}not${reset} be compiled.`);
  }

  // Make sure we watch the source file for changes.
  // CSS is not watched by default in eleventy
  eleventyConfig.addWatchTarget(source);


  // Run the Tailwind command in the before event handler.
  eleventyConfig.on("eleventy.before", () => {

    // console.log("running command", execSyncString )
    if (inputValid) {
      child_process.execSync(execSyncString, { stdio: 'inherit' }); // { stdio: 'inherit' } passes the shell context
    }
  });

  // Watch the output file
  // Required because eleventy reloads the dev server before the tailwind command finishes. 
  // Leads to two reloads, but I can't find a way around this as yet
  if (options.watchOuput) {
    eleventyConfig.setServerOptions({
      watch: [generated]
    });
  }

};

module.exports = tailwindcss;
