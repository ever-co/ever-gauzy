const baseConfig = require('../../eslint.config.js');

// The MJML compiler reads files from disk for `<mj-include>` unless told not to, and email/accounting
// templates are tenant-editable (GHSA-48h9-vwf5-h8m7). Every compile must go through
// `src/lib/email-template/compile-mjml.ts`, which disables includes; importing the compiler anywhere
// else in this package is a lint error. Covers `import` and `import x = require()`
// (`no-restricted-imports`) as well as `require()` and dynamic `import()` (`no-restricted-syntax`).
const MJML_MODULES = ['mjml', 'mjml-core', 'mjml-parser-xml'];
const MJML_MESSAGE =
	'Compile MJML through compileMjml() in src/lib/email-template/compile-mjml.ts; it disables <mj-include> file reads (GHSA-48h9-vwf5-h8m7).';
// esquery regex literal; no '/' allowed inside. Matches `mjml`, `mjml-core`, `mjml-parser-xml` and their subpaths.
const MJML_MODULE_REGEX = '/^mjml(-core|-parser-xml)?(?![A-Za-z0-9_.-])/';
const restrictMjmlImports = {
	name: 'gauzy/core/restrict-mjml-imports',
	files: ['**/*.ts', '**/*.js', '**/*.cts', '**/*.mts', '**/*.cjs', '**/*.mjs'],
	ignores: ['**/src/lib/email-template/compile-mjml.ts'],
	rules: {
		'no-restricted-imports': [
			'error',
			{
				paths: MJML_MODULES.map((name) => ({ name, message: MJML_MESSAGE })),
				patterns: [{ group: MJML_MODULES.map((name) => `${name}/*`), message: MJML_MESSAGE }]
			}
		],
		'no-restricted-syntax': [
			'error',
			{
				selector: `CallExpression[callee.name='require'][arguments.0.value=${MJML_MODULE_REGEX}]`,
				message: MJML_MESSAGE
			},
			{
				selector: `ImportExpression[source.value=${MJML_MODULE_REGEX}]`,
				message: MJML_MESSAGE
			}
		]
	}
};

module.exports = [
	...baseConfig,
	restrictMjmlImports,
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
