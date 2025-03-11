# Eleventy Plugin TailwindCSS 4 
An eleventy plugin to make it easier to use Tailwind 4.x with Eleventy 3.x

## Installation & configuration

Install `eleventy-plugin-tailwindcss-4` (this plugin), `tailwindcss` and `@tailwindcss/cli` into your Eleventy project
```bash
$ npm -i eleventy-plugin-tailwindcss-4 tailwindcss @tailwindcss/cli 
```
### Configure Eleventy
Import the plugin in your configuration file `eleventy.config.js`.
```js
import tailwindcss from 'eleventy-plugin-tailwindcss-4'

export default (eleventyConfig) => {
  eleventyConfig.addPlugin(tailwindcss, {
    input: './src/css/tailwind.css',
    output:'./dist/styles.css'
  });
};

export const config = {
  htmlTemplateEngine: "njk",
  dir: {
    input: "src",
    output: "dist"
  },
};
```
### Create a Tailwind source file
 In Tailwind 4 this file acts both as your source CSS file and the Tailwind Config file: `src/css/tailwind.css`
```css
@import 'tailwindcss';
```
### Link to the generated CSS
Ensure you have link to the generated style sheet in the `<head>` of your template.

```html
<link rel="stylesheet" href="/styles.css">
```

## Example repo
[Example repo](https://github.com/dwkns/etw-minimal) of the plugin installed, configured and working.

## Known Issues
Eleventy does not wait for `eleventy.after` to complete before the dev server reload is triggered. To ensure that your CSS changes are picked up, the plugin watches the generated CSS in your output folder and reloads the dev server when its finished compiling. 

This means you have two dev server reloads and sometimes you might see some jankiness. However this I feel is prefereable to having to manually refresh the browser everytime. 

A soultion will probably require a "Wait until complete" feature in `eleventy.after` or the ability to set a `waitBeforeRefresh` in the dev server.  

## To do
- [ ] Add option for minification.
- [ ] Add error checking for missing input file.
- [ ] Solve the two reload problem. 

## Thanks
@Hidden on the 11ty Discord

