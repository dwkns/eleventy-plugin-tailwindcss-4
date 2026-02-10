import tailwindcss from './index.js';


/** @param {import("@11ty/eleventy/UserConfig").default} eleventyConfig */

export default (eleventyConfig) => {

   eleventyConfig.addPlugin(tailwindcss, {
    debug: true,
    input: "css/tailwind.css",
  });
}

export const config = {
  dir: {
    input: "src",
    output: "dist",
  },
};
