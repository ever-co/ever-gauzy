const nx = require('@nx/eslint-plugin');
const baseConfig = require('../../eslint.config.js');

module.exports = [
	...baseConfig,
	{
		files: ['**/*.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}']
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
					prefix: 'lib',
					style: 'camelCase'
				}
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'lib',
					style: 'kebab-case'
				}
			],
			"prettier/prettier": [
				"error",
				{
					"singleQuote": true,
					"semi": true
				}
			],
			"@angular-eslint/no-host-metadata-property": "error",
			"@angular-eslint/no-input-rename": "error",
			"@angular-eslint/no-output-rename": "error",
			"@angular-eslint/no-lifecycle-call": "error",
			"@angular-eslint/use-lifecycle-interface": "error",
			"@angular-eslint/no-pipe-impure": "error",
			"@angular-eslint/template/eqeqeq": ["error", "smart"],
			"@angular-eslint/template/no-call-expression": "warn",
			"@angular-eslint/template/accessibility-alt-text": "warn",
			"@angular-eslint/template/accessibility-valid-aria": "warn"
		}
	},
	{
		files: ['**/*.html'],
		// Override or add rules here
		rules: {}
	}
];
