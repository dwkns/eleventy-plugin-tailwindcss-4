# Eleventy Plugin TailwindCSS 4 
An Eleventy plugin to make it easier to use Tailwind 4.0.x with Eleventy 3.0.x

## Version 2.0
This version uses PostCSS under the hood to process your templates. It is MUCH faster than version 1.x.x. 

## Installation & configuration

Install `eleventy-plugin-tailwindcss-4` into your Eleventy project.
```bash
$ npm -i eleventy-plugin-tailwindcss-4 
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
All ther options are optional see below. 
```js
eleventyConfig.addPlugin(tailwindcss, {
  input: 'css/tailwind.css' // required
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
    domDiff: false,
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
| minify      | Optional | Boolean  | false        | Use cssnano to minify.                                             |
| watchOutput | Optional | Boolean  | true         | Force a browser reload when output is written                      |      
| domDiff     | Optional | Boolean  | false        | Don't use Dev Server domDiffing as it causes unstyled flashes      |      
| debug       | Optional | Boolean  | false        | Show plugin and Tailwind debug output.                             |


## Example repo
[Example repo](https://github.com/dwkns/etw-minimal) of the plugin installed, configured (ES6) and working.

## Known Issues
There is an issue with the domDiffing of the Dev Server happening before the plugin can write the CSS to the output folder. This can cause an extra reload in the browser and in some circumstances a flash of incorrectly styled content. The plugin turns off domDiffing by default which stops this from happening. 

You can overide this with `domDiff: true` in the options if you need to. 

## Versions
2.0.1 Fixes an issue where in some cases output CSS could be written before output folder was created. 
2.0.0 Major rewrite to use PostCSS under the hood

## Thanks
@Hidden on the 11ty Discord

