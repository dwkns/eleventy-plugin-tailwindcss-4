// rollup.config.js
export default {
	input: 'index.js',
	output: {
		file: 'index.cjs',
		format: 'cjs'
	},
	external: ['fs', 'child_process'] 
};

