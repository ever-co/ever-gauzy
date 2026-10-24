jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import { Logger } from '@nestjs/common';
import { getControllerClass } from './jira.controller';

const SHARED_SECRET = 'installation-shared-secret';

/**
 * The Jira lifecycle and webhook routes are public, and each used to print its whole request body to the API's
 * logs: the `installed` payload Atlassian sends carries the installation's `sharedSecret`, and any anonymous caller
 * could write whatever it liked there.
 */
describe('Jira hook controller', () => {
	const HookController = getControllerClass({ path: 'integration/jira', config: {} } as never);
	const controller = new HookController();
	const body = {
		key: 'app',
		clientKey: 'client',
		sharedSecret: SHARED_SECRET,
		baseUrl: 'https://site.atlassian.net'
	};

	let written: unknown[][];

	beforeEach(() => {
		written = [];
		const record = (...args: unknown[]) => void written.push(args);
		jest.spyOn(console, 'log').mockImplementation(record);
		for (const method of ['log', 'debug', 'verbose', 'warn', 'error'] as const) {
			jest.spyOn(Logger.prototype, method).mockImplementation(record);
		}
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(['installed', 'uninstalled', 'issueCreated', 'issueDeleted', 'issueUpdated'])(
		'does not write the body %s receives to the logs',
		(handler) => {
			expect(controller[handler](body)).toBeUndefined();

			expect(JSON.stringify(written)).not.toContain(SHARED_SECRET);
			expect(JSON.stringify(written)).not.toContain('client');
		}
	);
});
