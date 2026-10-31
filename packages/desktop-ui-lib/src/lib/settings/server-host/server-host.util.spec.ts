import {
	checkServerHost,
	IServerHostRule,
	isValidServerHost,
	normalizeServerHost,
	parseServerHost,
	SERVER_HOST_INVALID_MESSAGE,
	toServerHostAddress,
	withDetectedAddress
} from './server-host.util';

const WARNINGS = {
	sslWithIp: 'TIMER_TRACKER.SETTINGS.SERVER_HOST.SSL_WITH_IP',
	ipv6Brackets: 'TIMER_TRACKER.SETTINGS.SERVER_HOST.IPV6_BRACKETS',
	port: 'TIMER_TRACKER.SETTINGS.SERVER_HOST.PORT',
	path: 'TIMER_TRACKER.SETTINGS.SERVER_HOST.PATH'
};

describe('parseServerHost', () => {
	it.each([
		['0.0.0.0', 'ipv4'],
		['127.0.0.1', 'ipv4'],
		['192.168.1.20', 'ipv4'],
		['10.0.0.5', 'ipv4'],
		['255.255.255.255', 'ipv4'],
		['localhost', 'hostname'],
		['gauzy-server', 'hostname'],
		['gauzy.example.com', 'hostname'],
		['gauzy.example.com.', 'hostname'],
		['my_server.lan', 'hostname'],
		['xn--bcher-kva.example', 'hostname'],
		['bücher.example', 'hostname'],
		['::1', 'ipv6'],
		['::', 'ipv6'],
		['2001:db8::20', 'ipv6'],
		['2001:0db8:0000:0000:0000:ff00:0042:8329', 'ipv6'],
		['fd00::20', 'ipv6'],
		['::ffff:192.168.1.20', 'ipv6'],
		['fe80::1%eth0', 'ipv6'],
		['[::1]', 'ipv6'],
		['[2001:db8::20]:3000', 'ipv6']
	])('accepts %s as %s', (value, kind) => {
		expect(parseServerHost(value).kind).toBe(kind);
	});

	it.each([
		['http://192.168.1.20', 'http', '192.168.1.20', null],
		['https://gauzy.example.com', 'https', 'gauzy.example.com', null],
		['HTTPS://Gauzy.Example.com', 'https', 'Gauzy.Example.com', null],
		['192.168.1.20:3000', null, '192.168.1.20', '3000'],
		['http://localhost:8080', 'http', 'localhost', '8080'],
		['https://[fd00::20]:443', 'https', 'fd00::20', '443']
	])('reads %s as scheme %s, host %s and port %s', (value, scheme, hostname, port) => {
		expect(parseServerHost(value)).toEqual(expect.objectContaining({ scheme, hostname, port }));
	});

	it.each([
		'999.1.1.1',
		'192.168.1.256',
		'192.168.1',
		'1.2.3.4.5',
		'12345',
		'bad host!',
		'bad-host!',
		'-gauzy.example.com',
		'gauzy-.example.com',
		'gauzy..example.com',
		'a'.repeat(64) + '.example.com',
		'http://',
		'https://:3000',
		'ftp://gauzy.example.com',
		'user:secret@gauzy.example.com',
		'gauzy.example.com:',
		'gauzy.example.com:0',
		'gauzy.example.com:65536',
		'gauzy.example.com:port',
		'[::1',
		'[::1]x',
		'[gauzy.example.com]',
		'1:::2',
		'1::2::3',
		':1:2:3:4:5:6:7',
		'1:2:3:4:5:6:7:8:9',
		'::ffff:999.1.1.1',
		'gggg::1'
	])('rejects %s', (value) => {
		expect(parseServerHost(value).kind).toBe('invalid');
	});

	it('reads an empty value (the default, 0.0.0.0) as empty, not invalid', () => {
		expect(parseServerHost('').kind).toBe('empty');
		expect(parseServerHost('   ').kind).toBe('empty');
		expect(parseServerHost(null).kind).toBe('empty');
		expect(parseServerHost(undefined).kind).toBe('empty');
	});

	it('ignores spaces around the value', () => {
		expect(parseServerHost('  192.168.1.20 ')).toEqual(
			expect.objectContaining({ kind: 'ipv4', hostname: '192.168.1.20' })
		);
	});

	it('tells whether an IPv6 address is in brackets', () => {
		expect(parseServerHost('[fd00::20]').bracketed).toBe(true);
		expect(parseServerHost('fd00::20').bracketed).toBe(false);
	});

	it('keeps what follows the host as the path', () => {
		expect(parseServerHost('https://gauzy.example.com/').path).toBe('/');
		expect(parseServerHost('gauzy.example.com/gauzy?x=1').path).toBe('/gauzy?x=1');
		expect(parseServerHost('gauzy.example.com').path).toBeNull();
	});
});

describe('isValidServerHost', () => {
	it.each([
		'',
		'0.0.0.0',
		'127.0.0.1',
		'192.168.1.20',
		'localhost',
		'gauzy.example.com',
		'::1',
		'[::1]',
		'http://192.168.1.20:3000',
		'https://gauzy.example.com'
	])('keeps accepting %s (accepted before the check existed)', (value) => {
		expect(isValidServerHost(value)).toBe(true);
	});

	it.each(['999.1.1.1', 'bad host!'])('blocks %s', (value) => {
		expect(isValidServerHost(value)).toBe(false);
	});
});

describe('checkServerHost', () => {
	it('returns the error, and no warnings, for an invalid value', () => {
		expect(checkServerHost('999.1.1.1', { sslEnabled: true })).toEqual(
			expect.objectContaining({ valid: false, error: SERVER_HOST_INVALID_MESSAGE, warnings: [] })
		);
	});

	it('has nothing to say about a plain LAN address or name', () => {
		for (const value of ['192.168.1.20', 'gauzy.example.com', 'http://gauzy.example.com', '[fd00::20]', '']) {
			expect(checkServerHost(value)).toEqual(expect.objectContaining({ valid: true, error: null, warnings: [] }));
		}
	});

	describe('SSL on (#7549)', () => {
		it.each(['192.168.1.20', '0.0.0.0', '', '[fd00::20]', 'https://10.0.0.5'])(
			'warns, without blocking, that %s is an IP address',
			(value) => {
				const check = checkServerHost(value, { sslEnabled: true });
				expect(check.valid).toBe(true);
				expect(check.warnings).toContain(WARNINGS.sslWithIp);
			}
		);

		it.each(['gauzy.example.com', 'localhost', 'https://gauzy.example.com'])(
			'has no warning for the name %s',
			(value) => {
				expect(checkServerHost(value, { sslEnabled: true }).warnings).toEqual([]);
			}
		);

		it('has no SSL warning while SSL is off', () => {
			expect(checkServerHost('192.168.1.20', { sslEnabled: false }).warnings).toEqual([]);
			expect(checkServerHost('192.168.1.20').warnings).toEqual([]);
		});
	});

	it('warns that an IPv6 address needs brackets in a URL', () => {
		expect(checkServerHost('fd00::20').warnings).toEqual([WARNINGS.ipv6Brackets]);
		expect(checkServerHost('[fd00::20]').warnings).toEqual([]);
	});

	it('warns that a port belongs in the port fields', () => {
		expect(checkServerHost('192.168.1.20:3000').warnings).toEqual([WARNINGS.port]);
		expect(checkServerHost('http://gauzy.example.com:8080').warnings).toEqual([WARNINGS.port]);
	});

	it('warns that a path is not part of the host', () => {
		expect(checkServerHost('https://gauzy.example.com/').warnings).toEqual([WARNINGS.path]);
	});

	it('lists every warning that applies', () => {
		expect(checkServerHost('https://10.0.0.5:443/gauzy', { sslEnabled: true }).warnings).toEqual([
			WARNINGS.sslWithIp,
			WARNINGS.port,
			WARNINGS.path
		]);
	});

	it('takes other rules (extension point)', () => {
		const localhostRule: IServerHostRule = {
			message: 'LOCALHOST',
			applies: ({ hostname }) => hostname === 'localhost'
		};
		expect(checkServerHost('localhost', {}, [localhostRule]).warnings).toEqual(['LOCALHOST']);
		expect(checkServerHost('gauzy.example.com', {}, [localhostRule]).warnings).toEqual([]);
	});
});

describe('normalizeServerHost', () => {
	it('removes spaces around the value', () => {
		expect(normalizeServerHost(' 192.168.1.20  ')).toBe('192.168.1.20');
	});

	it('leaves a missing value alone', () => {
		expect(normalizeServerHost(undefined)).toBeUndefined();
		expect(normalizeServerHost(null)).toBeNull();
	});
});

describe('toServerHostAddress', () => {
	it('writes an IPv4 address as it is', () => {
		expect(toServerHostAddress({ address: '192.168.1.20', family: 'IPv4' })).toBe('192.168.1.20');
	});

	it('puts an IPv6 address in brackets, as a URL needs', () => {
		expect(toServerHostAddress({ address: 'fd00::20', family: 'IPv6' })).toBe('[fd00::20]');
	});
});

describe('withDetectedAddress', () => {
	const lan = { address: '192.168.1.20', family: 'IPv4' as const };

	it('fills an empty field with the address', () => {
		expect(withDetectedAddress('', lan)).toBe('192.168.1.20');
		expect(withDetectedAddress(null, lan)).toBe('192.168.1.20');
	});

	it('replaces the host, keeping http:// or https://', () => {
		expect(withDetectedAddress('0.0.0.0', lan)).toBe('192.168.1.20');
		expect(withDetectedAddress('https://old.example.com', lan)).toBe('https://192.168.1.20');
		expect(withDetectedAddress('HTTP://old.example.com:8080/x', lan)).toBe('http://192.168.1.20');
	});

	it('brackets an IPv6 address', () => {
		expect(withDetectedAddress('http://0.0.0.0', { address: 'fd00::20', family: 'IPv6' })).toBe(
			'http://[fd00::20]'
		);
	});
});
