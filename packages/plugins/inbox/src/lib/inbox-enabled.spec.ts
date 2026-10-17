import { isInboxEnabled } from './inbox-enabled';
import { InboxSourceHandlerRegistry } from './inbox-source-handler.registry';

describe('isInboxEnabled', () => {
	it.each([
		['unset (the default)', undefined, false, 0],
		['empty', '', false, 0],
		['false', 'false', false, 0],
		['true', 'true', true, 0],
		['TRUE', 'TRUE', false, 1],
		['1', '1', false, 1],
		['yes', 'yes', false, 1]
	])('GAUZY_INBOX_ENABLED %s → %s, %i warning(s), never echoing the value', (_name, value, enabled, warnings) => {
		const warn = jest.fn();
		expect(isInboxEnabled({ GAUZY_INBOX_ENABLED: value }, warn)).toBe(enabled);
		expect(warn).toHaveBeenCalledTimes(warnings);
		for (const [message] of warn.mock.calls) {
			if (value) expect(message).not.toContain(`"${value}" `);
		}
	});
});

describe('InboxSourceHandlerRegistry', () => {
	const handler = (source: string) => ({ source, onReply: jest.fn(async () => ({ routed: 'ok' })) });

	it('registers one handler per source, and finds it', () => {
		const registry = new InboxSourceHandlerRegistry();
		const everWorks = handler('EVER_WORKS');
		registry.register(everWorks);
		registry.register(everWorks); // the same handler again: a no-op
		expect(registry.get('EVER_WORKS')).toBe(everWorks);
		expect(registry.sources()).toEqual(['EVER_WORKS']);
	});

	it('refuses a second, different handler for a taken source, and a handler without a source or onReply', () => {
		const registry = new InboxSourceHandlerRegistry();
		registry.register(handler('EVER_WORKS'));
		expect(() => registry.register(handler('EVER_WORKS'))).toThrow(/already registered/);
		expect(() => registry.register(handler('  '))).toThrow(/needs a source/);
		expect(() => registry.register({ source: 'X' } as never)).toThrow(/onReply/);
	});

	it('unregisters', () => {
		const registry = new InboxSourceHandlerRegistry();
		registry.register(handler('EVER_WORKS'));
		registry.unregister('EVER_WORKS');
		expect(registry.get('EVER_WORKS')).toBeUndefined();
	});
});
