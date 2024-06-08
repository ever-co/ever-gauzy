//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
const TerserPlugin = require('terser-webpack-plugin');

console.log('Using custom Webpack config...');

function isCircleCI() {
	return process.env.CI === 'true' && process.env.CIRCLECI === 'true';
}

const isCircleEnv = isCircleCI();

if (isCircleEnv) {
	console.log('Building in CircleCI environment');
}

module.exports = {
	resolve: {
		mainFields: ['es2016', 'browser', 'module', 'main']
	},
	optimization: {
		concatenateModules: false,
		// for now let's disable minimize in CircleCI
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
		'electron-log': 'electron-log'
	}
};

/* NOTE: below code can be used to fix some more things, see https://github.com/maximegris/angular-electron/blob/master/angular.webpack.js#L10
    if (options.fileReplacements) {
        for(let fileReplacement of options.fileReplacements) {
            if (fileReplacement.replace !== 'apps/server/src/environments/environment.ts' && fileReplacement.replace !== 'apps/gauzy/src/environments/environment.ts') {
                continue;
            }

            let fileReplacementParts = fileReplacement['with'].split('.');
            if (fileReplacementParts.length > 1 && ['web'].indexOf(fileReplacementParts[1]) >= 0) {
                config.target = 'web';
            }
            break;
        }
    }
*/
