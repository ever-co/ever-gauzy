import {
	checkServerHost,
	IServerHostRule,
	isValidServerHost,
	normalizeServerHost,
	parseServerHost,
	reachableServerAddresses,
	SERVER_HOST_INVALID_MESSAGE,
	toServerHostAddress,
	withDetectedAddress
} from './server-host.util';

const WARNINGS = {
	sslWithIp: 'TIMER_TRACKER.SETTINGS.SERVER_HOST.SSL_WITH_IP',
	ipv6: 'TIMER_TRACKER.SETTINGS.SERVER_HOST.IPV6',
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
		['gauzy.0xg', 'hostname'],
		['0x.example', 'hostname'],
		['gauzy.1e3', 'hostname'],
		['xn--bcher-kva.example', 'hostname'],
		['bücher.example', 'hostname'],
		['https://bücher.example:3000', 'hostname'],
		['bücher。example', 'hostname'],
		['ｌｏｃａｌｈｏｓｔ', 'hostname'],
		['☕.example', 'hostname'],
		['１９２.１６８.１.２０', 'ipv4'],
		['192.168.001.001', 'ipv4'],
		['192.168.1.20.', 'ipv4'],
		['http://192.168.1.20.:3000', 'ipv4'],
		['192.168.1。20', 'ipv4'],
		['192.168.1.07', 'ipv4'],
		['00.0.0.0', 'ipv4'],
		['::ffff:0.0.0.0', 'ipv6'],
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
		'gggg::1',
		// A hexadecimal last label makes browsers read the name as an IPv4 address.
		'0xff',
		'gauzy.0xff',
		'gauzy.0X1F',
		'gauzy.0x',
		'gauzy.0xff.'
	])('rejects %s', (value) => {
		expect(parseServerHost(value).kind).toBe('invalid');
	});

	describe('IPv4 octets with a leading zero, which browsers read as octal', () => {
		it.each([
			['192.168.1.020', '192.168.1.16'],
			['192.168.1.010', '192.168.1.8'],
			['010.0.0.1', '8.0.0.1'],
			['192.168.001.020', '192.168.1.16'],
			['192.168.1.099', 'nothing (refused)'],
			['192.168.1.08', 'nothing (refused)'],
			['192.168.1.020.', '192.168.1.16'],
			// A fullwidth or ideographic dot and fullwidth digits map to ASCII ones first.
			['192.168.1。020', '192.168.1.16'],
			['192．168．1．０２０', '192.168.1.16']
		])('rejects %s, which a browser opens as %s', (value) => {
			expect(parseServerHost(value).kind).toBe('invalid');
		});

		it.each(['192.168.001.001', '192.168.1.07', '00.0.0.0'])(
			'keeps accepting %s, which means the same in both readings',
			(value) => {
				expect(parseServerHost(value)).toEqual(expect.objectContaining({ kind: 'ipv4', hostname: value }));
			}
		);

		it('rejects them in the IPv4 tail of an IPv6 address, which browsers refuse', () => {
			expect(parseServerHost('::ffff:192.168.1.01').kind).toBe('invalid');
			expect(parseServerHost('[::ffff:192.168.1.020]').kind).toBe('invalid');
		});
	});

	describe('internationalised names', () => {
		it.each([
			['bad／host', 'a fullwidth slash, which a URL reads as /'],
			['bad：host', 'a fullwidth colon, which a URL reads as :'],
			['bad＃host', 'a fullwidth number sign, which a URL reads as #'],
			['bad！host', 'a fullwidth exclamation mark, not allowed in a name'],
			['bad host', 'an ideographic space']
		])('rejects %s (%s)', (value) => {
			expect(parseServerHost(value).kind).toBe('invalid');
		});

		it('keeps the name as typed: the URL turns it into punycode itself', () => {
			expect(parseServerHost('bücher.example').hostname).toBe('bücher.example');
		});
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
		'https://gauzy.example.com',
		'bücher.example',
		'192.168.001.001',
		'192.168.1.20.'
	])('keeps accepting %s (accepted before the check existed)', (value) => {
		expect(isValidServerHost(value)).toBe(true);
	});

	it.each(['999.1.1.1', 'bad host!', '192.168.1.020', 'bad／host'])('blocks %s', (value) => {
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
		for (const value of ['192.168.1.20', 'gauzy.example.com', 'http://gauzy.example.com', 'bücher.example', '']) {
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

	it.each(['fd00::20', '[fd00::20]', 'http://[::1]:3000'])(
		'warns, without blocking, that the server cannot be reached on the IPv6 address %s',
		(value) => {
			const check = checkServerHost(value);
			expect(check.valid).toBe(true);
			expect(check.warnings).toContain(WARNINGS.ipv6);
		}
	);

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

describe('reachableServerAddresses', () => {
	const addresses = [
		{ name: 'Ethernet', address: 'fd00::20', family: 'IPv6' as const },
		{ name: 'Ethernet', address: '192.168.1.20', family: 'IPv4' as const },
		{ name: 'Wi-Fi', address: '10.0.0.5', family: 'IPv4' as const }
	];

	it('keeps the IPv4 addresses, in order: the servers listen on 0.0.0.0, which is IPv4 only', () => {
		expect(reachableServerAddresses(addresses).map(({ address }) => address)).toEqual(['192.168.1.20', '10.0.0.5']);
	});

	it('returns nothing when there are only IPv6 addresses', () => {
		expect(reachableServerAddresses([addresses[0]])).toEqual([]);
	});

	it('takes other families (extension point)', () => {
		expect(reachableServerAddresses(addresses, ['IPv4', 'IPv6'])).toEqual(addresses);
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
