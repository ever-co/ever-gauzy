jest.mock('@gauzy/config', () => ({
	environment: { jitsu: { serverHost: 'https://jitsu.example.test', serverWriteKey: 'write-key' } }
}));
// The real base subscriber and export redaction live in @gauzy/core; these stand-ins keep the test to this plugin.
jest.mock('@gauzy/core', () => ({
	BaseEntityEventSubscriber: class {
		afterInsert() {
			return Promise.resolve();
		}
		afterUpdate() {
			return Promise.resolve();
		}
		afterRemove() {
			return Promise.resolve();
		}
	},
	redactForExport: (_entityClass: unknown, row: object) => ({ ...row })
}));
const track = jest.fn();
jest.mock('./jitsu-helper', () => ({ createJitsu: () => ({ track }) }));

import { JitsuEventsSubscriber } from './jitsu-events.subscriber';

/** Lets the queue's `setImmediate` drains and the promise callbacks they start run. */
const settle = async () => {
	for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(() => {
	track.mockReset();
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('JitsuEventsSubscriber', () => {
	it('sends a burst of inserts a few at a time, none on the writer stack (the tenant-onboarding case)', async () => {
		// The Jitsu server does not answer: every request stays open.
		track.mockImplementation(() => new Promise(() => undefined));
		const subscriber = new JitsuEventsSubscriber();

		// Onboarding writes 3,136 role permissions in one save; each insert reaches this hook.
		for (let i = 0; i < 3136; i++) {
			await subscriber.afterEntityCreate({ id: `rp-${i}`, permission: 'ORG_VIEW' });
		}
		expect(track).not.toHaveBeenCalled();

		await settle();

		// It used to be 3,136 HTTPS requests at once from one pod: the event loop stalled and the onboarding
		// request timed out connecting to the database.
		expect(track).toHaveBeenCalledTimes(4);
	});

	it('sends the row as it was written, not as a later write left it', async () => {
		track.mockResolvedValue({});
		const subscriber = new JitsuEventsSubscriber();
		const row = { id: 'task-1', settings: { color: 'red' } };

		await subscriber.afterEntityCreate(row);
		row.settings.color = 'blue';
		await settle();

		expect(track).toHaveBeenCalledWith('afterEntityCreate', {
			data: { id: 'task-1', settings: { color: 'red' } }
		});
	});
});
