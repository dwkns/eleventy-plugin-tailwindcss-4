import { execSync } from 'child_process'

export const tailwindcss = (eleventyConfig, options) => {
  console.log("options: ", options)
  eleventyConfig.addWatchTarget(options.input);
  eleventyConfig.on("eleventy.after", () => {
    console.log("running command", `npx @tailwindcss/cli -i ${options.input} -o ${options.output}` )
    execSync(
      `npx @tailwindcss/cli -i ${options.input} -o ${options.output}`
    );
  });
  eleventyConfig.setServerOptions({
    watch: [options.output]
  })
}

export default tailwindcss;