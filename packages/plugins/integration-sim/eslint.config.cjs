const baseConfig = require('../../../eslint.config.js');

module.exports = [
	...baseConfig,
	{
		files: ['**/*.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}']
				}
			]
		},
		languageOptions: {
			parser: require('jsonc-eslint-parser')
		}
	}
];
