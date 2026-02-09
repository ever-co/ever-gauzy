const webpack = require('webpack');
//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
const TerserPlugin = require('terser-webpack-plugin');
//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const MomentTimezoneDataPlugin = require('moment-timezone-data-webpack-plugin');
const path = require('path');

console.log('Using custom Webpack config...');

function isCircleCI() {
	return process.env.CI === 'true' && process.env.CIRCLECI === 'true';
}

const isCircleEnv = isCircleCI();

if (isCircleEnv) {
	console.log('Building in CircleCI environment');
}

module.exports = {
	target: 'electron-renderer',
	resolve: {
		mainFields: ['es2016', 'browser', 'module', 'main'],
		alias: {
			'date-holidays': path.resolve(__dirname, '../src/app/date-holidays.mock.ts')
		}
	},
	module: {
		rules: [
			{
				test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/i,
				type: 'asset/resource',
				generator: {
					filename: 'assets/[name][ext]'
				}
			}
		]
	},
	optimization: {
		concatenateModules: true,
		// for now let's disable minimize in CircleCI
		minimize: true,
		minimizer: [
			new TerserPlugin({
				parallel: isCircleEnv ? 2 : true,
				terserOptions: {
					ecma: 2020,
					sourceMap: false,
					compress: true
				},
				extractComments: !isCircleEnv
			}),
			new CssMinimizerPlugin()
		]
	},
	externals: {
		'electron-log': 'electron-log'
	},
	plugins: [
		new NodePolyfillPlugin({
			excludeAliases: ['console']
		}),
		new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /en/),
		new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false }),
		new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /en/),
		new MomentTimezoneDataPlugin({
			startYear: 2024,
			endYear: 2030,
		}),
	],
	output: {
		globalObject: 'globalThis'
	}
};
