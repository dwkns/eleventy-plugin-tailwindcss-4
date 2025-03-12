'use strict';

var child_process = require('child_process');

const tailwindcss = (eleventyConfig, options) => {
  
  const source = `${eleventyConfig.dir.input}/${options.input}`;
  const generated = `${eleventyConfig.dir.output}/${options.output}`;

  eleventyConfig.addWatchTarget(source);
  eleventyConfig.on("eleventy.after", () => {
    // console.log("running command", `npx @tailwindcss/cli -i ${source} -o ${generated}` )
    child_process.execSync(
      `npx @tailwindcss/cli -i ${source} -o ${generated}`
    );
  });
  eleventyConfig.setServerOptions({
    watch: [generated]
  });
};

module.exports = tailwindcss;
