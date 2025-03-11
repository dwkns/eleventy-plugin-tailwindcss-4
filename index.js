import { execSync } from 'child_process'

export const tailwindcss = (eleventyConfig, options) => {
  
  const source = `${eleventyConfig.dir.input}/${options.input}`
  const generated = `${eleventyConfig.dir.output}/${options.output}`

  eleventyConfig.addWatchTarget(source);
  eleventyConfig.on("eleventy.after", () => {
    // console.log("running command", `npx @tailwindcss/cli -i ${source} -o ${generated}` )
    execSync(
      `npx @tailwindcss/cli -i ${source} -o ${generated}`
    );
  });
  eleventyConfig.setServerOptions({
    watch: [generated]
  })
}

export default tailwindcss;