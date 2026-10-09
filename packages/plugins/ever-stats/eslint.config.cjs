const baseConfig = require('../../../eslint.config.js');

/**
 * The anonymous statistics are built from counters only. They never reuse an analytics client
 * (which would send identifying data) or the Ever Platform connection (which has its own key).
 */
module.exports = [
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{ name: '@gauzy/plugin-jitsu-analytics', message: 'The anonymous statistics never use analytics plugins.' },
						{ name: '@gauzy/plugin-posthog', message: 'The anonymous statistics never use analytics plugins.' },
						{ name: '@gauzy/plugin-ever-connect', message: 'The anonymous statistics are independent of the Ever Platform connection.' }
					]
				}
			]
		}
	}
];
