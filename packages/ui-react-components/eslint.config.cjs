const nx = require('@nx/eslint-plugin');
const baseConfig = require('../../.eslintrc.json');

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
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		rules: {}
	}
];
