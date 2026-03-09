const { FlatCompat } = require('@eslint/eslintrc');
const nx = require('@nx/eslint-plugin');

const compat = new FlatCompat({ baseDirectory: __dirname });
const baseConfig = compat.config(require('../../../.eslintrc.json'));

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
	...nx.configs['flat/angular'],
	...nx.configs['flat/angular-template'],
	{
		files: ['**/*.ts'],
		rules: {
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'gz',
					style: 'camelCase'
				}
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'gz',
					style: 'kebab-case'
				}
			]
		}
	},
	{
		files: ['**/*.html'],
		rules: {}
	}
];
