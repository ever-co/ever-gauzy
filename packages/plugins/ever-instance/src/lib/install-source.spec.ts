import { DEFAULT_INSTALL_SOURCE, INSTALL_SOURCES, isCloud, parseInstallSource } from './install-source';

describe('parseInstallSource', () => {
	it('defaults to self-hosted when EVER_INSTALL_SOURCE is unset or blank, without a log line', () => {
		const warn = jest.fn();
		expect(parseInstallSource({}, warn)).toBe('self-hosted');
		expect(parseInstallSource({ EVER_INSTALL_SOURCE: '   ' }, warn)).toBe('self-hosted');
		expect(DEFAULT_INSTALL_SOURCE).toBe('self-hosted');
		expect(warn).not.toHaveBeenCalled();
	});

	it.each(INSTALL_SOURCES.map((value) => [value]))('accepts %s', (value) => {
		const warn = jest.fn();
		expect(parseInstallSource({ EVER_INSTALL_SOURCE: value }, warn)).toBe(value);
		expect(warn).not.toHaveBeenCalled();
	});

	it.each([['partner:acme'], ['partner:ab'], ['partner:' + 'a'.repeat(32)]])('accepts %s', (value) => {
		expect(parseInstallSource({ EVER_INSTALL_SOURCE: value })).toBe(value);
	});

	it.each([['partner:A'], ['partner:a'], ['partner:ACME'], ['partner:acme corp'], ['partner:' + 'a'.repeat(33)], ['Cloud'], ['private-cloud'], ['https://acme.example']])(
		'maps %s to self-hosted with exactly one log line that does not repeat the value',
		(value) => {
			const warn = jest.fn();
			expect(parseInstallSource({ EVER_INSTALL_SOURCE: value }, warn)).toBe('self-hosted');
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0][0])).not.toContain(value);
		}
	);

	it('is cloud only when declared, never guessed from anything else', () => {
		expect(isCloud({ EVER_INSTALL_SOURCE: 'cloud' })).toBe(true);
		expect(isCloud({})).toBe(false);
		expect(isCloud({ STRIPE_SECRET_KEY: 'sk_live_x', DEMO: 'true', CLOUD_PROVIDER: 'civo', IS_ELECTRON: 'false' })).toBe(false);
	});
});
