# Eleventy Plugin TailwindCSS 4 
An Eleventy plugin to make it easier to use Tailwind 4.0.x with Eleventy 3.0.x

## Installation & configuration

Install `eleventy-plugin-tailwindcss-4` (this plugin), `tailwindcss` and `@tailwindcss/cli` into your Eleventy project.
```bash
$ npm -i eleventy-plugin-tailwindcss-4 tailwindcss @tailwindcss/cli 
```

### Create a Tailwind source/config file
 In Tailwind 4 this file acts both as your source CSS file and the Tailwind Config file.
```css
/* src/css/tailwind.css */
@import 'tailwindcss';
```
### Configure Eleventy
Import the plugin in your configuration file `eleventy.config.js`.

### ES6
```js
import tailwindcss from 'eleventy-plugin-tailwindcss-4'
```

### CJS
```js
const tailwindcss = require('eleventy-plugin-tailwindcss-4')
```
### Add the plugin
`input` Is the only **_required_** option. It is your Tailwind source/config file and is relative to your Eleventy [input folder](https://www.11ty.dev/docs/config/#input-directory). 
Other options are optional see all below. 
```js
eleventyConfig.addPlugin(tailwindcss, inputCSS, {
  input: 'css/tailwind.css' 
} );
```

#### ES6 Basic example
Generate output CSS at `_site/styles.css` from your input at `src/css/tailwind.css`
```js
import tailwindcss from 'eleventy-plugin-tailwindcss-4'

export default (eleventyConfig) => {
  eleventyConfig.addPlugin(tailwindcss, {
    input: 'css/tailwind.css' 
  } );

}
```

#### ES6 all options at default settings example
Generate output CSS at `_site/styles.css` from your input at `src/css/tailwind.css`
```js
import tailwindcss from 'eleventy-plugin-tailwindcss-4'

export default (eleventyConfig) => {
  eleventyConfig.addPlugin(tailwindcss, {
    input:'css/tailwind.css',
    output: 'styles.css',
    minify: false,
    watchOutput: true,
    debug: false
  });

}
```
#### CJS example
Generate minified CSS output at `_site/css/main.css`
```js
const tailwindcss = require('eleventy-plugin-tailwindcss-4')

module.exports = function (eleventyConfig) {

  eleventyConfig.addPlugin(tailwindcss, {
    input: 'css/tailwind.css', 
    output: 'css/main.css',
    minify: true
  });

};
```

### Link to the generated CSS
By defaul the plugin writes out your CSS to `_site/styles.css` or whatever you have named your [output folder](https://www.11ty.dev/docs/config/#output-directory). Ensure you have link to the generated style sheet in the `<head>` of your template.

```html
<link rel="stylesheet" href="/styles.css">
```

### Options

| Option      | Required | Type     | Default      | Description                                                        |
| :---------- | :------- | :------- | :----------- | :----------------------------------------------------------------- | 
| input       | Yes      | String   | -            | Tailwind source CSS/config relative to your Eleventy output folder.|
| output      | Optional | String   | 'styles.css' | Output filename relative to your Eleventy output folder.           |
| minify      | Optional | Boolean  | false        | Use Tailwind's minify option.                                      |
| watchOutput | Optional | Boolean  | true         | Force a browser reload when output is written (see KOptionalues).  |      
| debug       | Optional | Boolean  | false        | Show plugin and Tailwind debug output.                             |


## Example repo
[Example repo](https://github.com/dwkns/etw-minimal) of the plugin installed, configured (ES6) and working.

## Known Issues
Eleventy does not wait for [Eeventy events](https://www.11ty.dev/docs/events/) to complete before the dev server reload is triggered. To ensure that your CSS changes are picked up, the plugin watches the generated CSS in your output folder and reloads the dev server when its finished compiling. 

This means you have two dev server reloads and sometimes you might see some jankiness. However this I feel is prefereable to having to manually refresh the browser everytime. 

You can turn this behaviour off with `watchOutput: false`, but you may have to reload your page manually to see all CSS changes.

A soultion will probably require a "Wait until complete" feature in `eleventy.before` or the ability to set a `waitBeforeRefresh` in the dev server. See [#3692](https://github.com/11ty/eleventy/issues/3692) and [#104](https://github.com/11ty/eleventy-dev-server/issues/104)

## Thanks
@Hidden on the 11ty Discord

