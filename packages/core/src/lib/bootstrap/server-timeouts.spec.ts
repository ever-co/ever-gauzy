import { createServer } from 'node:http';
import { applyKeepAliveTimeouts, DEFAULT_KEEP_ALIVE_TIMEOUT_MS, resolveKeepAliveTimeout } from './server-timeouts';

describe('API HTTP server keep-alive timeouts', () => {
	describe('resolveKeepAliveTimeout', () => {
		it('outlives nginx’s 60 s upstream keepalive_timeout by default', () => {
			expect(resolveKeepAliveTimeout(undefined)).toBe(DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
			expect(resolveKeepAliveTimeout('  ')).toBe(DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
			expect(DEFAULT_KEEP_ALIVE_TIMEOUT_MS).toBe(65_000);
			expect(DEFAULT_KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(60_000);
		});

		it('takes a positive whole number of milliseconds', () => {
			expect(resolveKeepAliveTimeout('75000')).toBe(75_000);
			expect(resolveKeepAliveTimeout(' 125000 ')).toBe(125_000);
		});

		it.each(['0', '-1', '65s', '6.5e4.1', 'abc', '1.5'])(
			'falls back to the default for %p, with a warning',
			(raw) => {
				const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
				try {
					expect(resolveKeepAliveTimeout(raw)).toBe(DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
					expect(warn).toHaveBeenCalledTimes(1);
				} finally {
					warn.mockRestore();
				}
			}
		);
	});

	describe('applyKeepAliveTimeouts', () => {
		it('sets keepAliveTimeout, and headersTimeout one second above it, on a real Node server', () => {
			const server = createServer();
			// CONTROL: Node's own default would close an idle upstream socket after 5 s.
			expect(server.keepAliveTimeout).toBe(5_000);

			expect(applyKeepAliveTimeouts(server, 65_000)).toEqual({
				keepAliveTimeout: 65_000,
				headersTimeout: 66_000
			});
			expect(server.keepAliveTimeout).toBe(65_000);
			expect(server.headersTimeout).toBe(66_000);
			// Still below the whole-request timeout, which must stay the outer bound.
			expect(server.headersTimeout).toBeLessThan(server.requestTimeout);
		});
	});
});
