const baseConfig = require('../../../eslint.config.js');

module.exports = [
	...baseConfig,
	{ ignores: ['**/.cache/**'] },
	{
		files: ['**/*.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					ignoredFiles: [
						'{projectRoot}/eslint.config.{js,cjs,mjs}',
						'{projectRoot}/jest.config.{js,cjs,mjs,ts,cts,mts}',
						'{projectRoot}/src/test-setup.ts'
					],
					// ng-packagr emits decorator helpers, which are absent from source imports.
					runtimeHelpers: ['tslib']
				}
			]
		},
		languageOptions: {
			parser: require('jsonc-eslint-parser')
		}
	}
];
