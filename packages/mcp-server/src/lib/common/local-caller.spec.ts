import { isLocalCaller } from './local-caller';

/**
 * Who may act as the GAUZY_AUTO_LOGIN account without a login of their own: only a caller on the machine the server
 * runs on. Everyone else who can reach the HTTP or WebSocket port used to act as that account too.
 */
describe('isLocalCaller', () => {
	it('accepts a client on this machine', () => {
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001' })).toBe(true);
		expect(isLocalCaller('::ffff:127.0.0.1', { host: '127.0.0.1:3001' })).toBe(true);
		expect(isLocalCaller('::1', { host: '[::1]:3001' })).toBe(true);
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001', origin: 'http://localhost:4200' })).toBe(true);
	});

	it('refuses a client on another host', () => {
		expect(isLocalCaller('192.168.1.20', { host: 'localhost:3001' })).toBe(false);
		expect(isLocalCaller('172.17.0.1', { host: 'localhost:3001' })).toBe(false);
		expect(isLocalCaller(undefined, { host: 'localhost:3001' })).toBe(false);
	});

	it('refuses a page whose DNS name was rebound to this machine', () => {
		expect(isLocalCaller('127.0.0.1', { host: 'rebind.attacker.example:3001' })).toBe(false);
		expect(
			isLocalCaller('127.0.0.1', {
				host: 'rebind.attacker.example:3001',
				origin: 'http://rebind.attacker.example:3001'
			})
		).toBe(false);
	});

	it('refuses a page of another site, even one that names this machine', () => {
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001', origin: 'https://attacker.example' })).toBe(false);
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001', origin: 'null' })).toBe(false);
	});

	it('refuses a request a proxy relayed', () => {
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001', 'x-forwarded-for': '203.0.113.9' })).toBe(false);
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001', forwarded: 'for=203.0.113.9' })).toBe(false);
		expect(isLocalCaller('127.0.0.1', { host: 'localhost:3001', 'x-real-ip': '203.0.113.9' })).toBe(false);
		expect(isLocalCaller('127.0.0.1', { host: 'mcp.example.com' })).toBe(false);
		expect(isLocalCaller('::ffff:127.0.0.1', { host: 'localhost:3001' }, ['127.0.0.1'])).toBe(false);
	});

	it('reads the Host header as a host and port only', () => {
		expect(isLocalCaller('127.0.0.1', { host: 'attacker.example@localhost' })).toBe(false);
		expect(isLocalCaller('127.0.0.1', { host: 'localhost/@attacker.example' })).toBe(false);
		expect(isLocalCaller('127.0.0.1', {})).toBe(false);
	});
});
