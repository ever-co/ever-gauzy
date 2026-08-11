const nx = require('@nx/eslint-plugin');
const baseConfig = require('../../../.eslintrc.json');

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
					prefix: 'gzDocs',
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
			],
			// Bundle guard: TipTap belongs to the lazily-loaded page editor chunk only (Wave 4).
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@tiptap/*'],
							message: 'TipTap may only be imported from pages/page-editor (lazy editor chunk).'
						}
					]
				}
			]
		}
	},
	{
		files: ['**/pages/page-editor/**/*.ts'],
		rules: {
			'no-restricted-imports': 'off'
		}
	},
	{
		// `docs-export.service.ts` reaches TipTap only through `await import(...)`,
		// which is what keeps the renderer out of the browse chunk in the first
		// place (Wave 8 export actions run from the detail panel). The guard above
		// exists to stop *static* TipTap imports leaking into that chunk — a
		// deliberate dynamic import is the sanctioned escape hatch, not a leak.
		files: ['**/services/docs-export.service.ts'],
		rules: {
			'no-restricted-imports': 'off'
		}
	},
	{
		files: ['**/*.html'],
		rules: {}
	}
];
