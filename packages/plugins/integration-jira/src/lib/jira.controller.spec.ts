import { Logger } from '@nestjs/common';
import { getControllerClass } from './jira.controller';

/**
 * The Jira hooks are public and their bodies unverified: a body is never written to the log.
 *
 * Every hook printed `JSON.stringify(body)`, so anyone could write what they liked into the server log, and the
 * `installed` lifecycle payload of a real installation — which carries the tenant's `sharedSecret` — landed there too.
 */
describe('Jira hooks — the bodies stay out of the log', () => {
	const SECRET = 'connect-shared-secret-value';
	const controller = new (getControllerClass({ path: 'jira', config: {} as never }))();

	afterEach(() => jest.restoreAllMocks());

	it.each(['issueCreated', 'issueDeleted', 'issueUpdated', 'installed', 'uninstalled'])(
		'%s writes nothing of the body to the console or the logger',
		(hook) => {
			const written: string[] = [];
			const capture = (...args: unknown[]) => void written.push(args.map((arg) => JSON.stringify(arg)).join(' '));
			jest.spyOn(console, 'log').mockImplementation(capture);
			for (const level of ['log', 'debug', 'verbose', 'warn', 'error'] as const) {
				jest.spyOn(Logger.prototype, level).mockImplementation(capture);
			}

			controller[hook]({ clientKey: 'client-key', sharedSecret: SECRET, issue: { key: 'GA-1' } });

			expect(written.join('\n')).not.toContain(SECRET);
			expect(written.join('\n')).not.toContain('GA-1');
		}
	);
});
