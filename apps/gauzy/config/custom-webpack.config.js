const TerserPlugin = require('terser-webpack-plugin');

console.log('Using custom Webpack config...');

function isCircleCI(){
	return process.env.CI === 'true' && process.env.CIRCLECI === 'true';
}

const isCircleEnv = isCircleCI();

if (isCircleEnv) {
	console.log('Building in CircleCI environment');
}

module.exports = {
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				parallel: isCircleEnv ? 2 : true,
				sourceMap: !isCircleEnv,
				extractComments: !isCircleEnv
			}),
		],
	},
};
