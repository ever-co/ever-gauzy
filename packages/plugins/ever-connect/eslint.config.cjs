const baseConfig = require('../../../eslint.config.js');

/**
 * Every request of the Ever Platform connection goes through the Ever Platform SDK's client (its
 * generated operation table, one base URL, no redirect): no other HTTP client, no analytics plugin,
 * and nothing of the anonymous statistics module (which is independent of it).
 *
 * `src/lib/vendor/` is the SDK's own code, copied unchanged by `scripts/vendor-connect-sdk.mjs`.
 */
module.exports = [
	{ ignores: ['src/lib/vendor/**'] },
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '@gauzy/plugin-jitsu-analytics',
							message: 'The Ever Platform connection never uses analytics plugins.'
						},
						{
							name: '@gauzy/plugin-posthog',
							message: 'The Ever Platform connection never uses analytics plugins.'
						},
						{
							name: '@gauzy/plugin-ever-stats',
							message: 'The Ever Platform connection is independent of the anonymous statistics.'
						},
						{ name: '@nestjs/axios', message: 'Ever Platform is called through the SDK client only.' },
						{ name: 'axios', message: 'Ever Platform is called through the SDK client only.' },
						{ name: 'undici', message: 'Ever Platform is called through the SDK client only.' }
					]
				}
			]
		}
	}
];
