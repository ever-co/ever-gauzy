const baseConfig = require('../../../eslint.config.js');

module.exports = [
	...baseConfig,
	{
		// The entity class name `Document` shadows the DOM `Document` global from TypeScript's
		// ambient lib. A file that forgets to import the entity still type-checks against the DOM
		// interface and misbehaves at runtime — make the bare global a lint error instead.
		files: ['src/**/*.ts'],
		rules: {
			'no-restricted-globals': [
				'error',
				{
					name: 'Document',
					message: "Import the entity explicitly: import { Document } from './entities/document.entity';"
				},
				{
					name: 'document',
					message: 'The DOM `document` global is not available in the backend plugin.'
				}
			]
		}
	},
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
	}
];
