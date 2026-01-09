const webpack = require('webpack');
//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
const TerserPlugin = require('terser-webpack-plugin');
//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

console.log('Using custom Webpack config...');

function isCircleCI() {
	return process.env.CI === 'true' && process.env.CIRCLECI === 'true';
}

const isCircleEnv = isCircleCI();

if (isCircleEnv) {
	console.log('Building in CircleCI environment');
}

module.exports = {
	target: 'web',
	resolve: {
		mainFields: ['es2016', 'browser', 'module', 'main'],
		conditionNames: ['browser', 'import', 'default'],
		fallback: {
			crypto: require.resolve('crypto-browserify'),
			stream: require.resolve('stream-browserify'),
			util: require.resolve('util/'),
			buffer: require.resolve('buffer/'),
			process: require.resolve('process/browser')
		}
	},
	optimization: {
		concatenateModules: false,
		minimize: !isCircleCI,
		minimizer: [
			new TerserPlugin({
				parallel: isCircleEnv ? 2 : true,
				terserOptions: {
					ecma: 2020,
					sourceMap: !isCircleEnv,
					compress: true
				},
				extractComments: !isCircleEnv
			})
		]
	},
	externals: {
		'electron-log': 'electron-log',
		electron: 'commonjs electron'
	},
	plugins: [
		new NodePolyfillPlugin({
			excludeAliases: ['console']
		}),
		new webpack.ProvidePlugin({
			process: 'process/browser',
			Buffer: ['buffer', 'Buffer']
		}),
		// Define global as window for browser compatibility
		new webpack.DefinePlugin({
			global: 'globalThis'
		})
	],
	output: {
		globalObject: 'globalThis'
	}
};
