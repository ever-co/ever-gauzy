import { isSenderAllowed, normalizeAddress, normalizeAddresses, normalizeSubject } from './address';

describe('mailbox addresses', () => {
	it('normalizes an address and keeps its +tag apart', () => {
		expect(normalizeAddress('Ada <Ada+Billing@Acme.Test>')).toEqual({ address: 'ada@acme.test', tag: 'billing' });
		expect(normalizeAddress(' support.ever@inbox.example.test ')).toEqual({
			address: 'support.ever@inbox.example.test'
		});
		expect(normalizeAddress('a+@b.test')).toEqual({ address: 'a@b.test' });
	});

	it('refuses what is not a plain address', () => {
		for (const value of [
			'',
			'no-at',
			'@b.test',
			'a@',
			'a b@c.test',
			'a@-b.test',
			'a@b',
			42,
			null,
			`${'x'.repeat(320)}@b.test`
		]) {
			expect(normalizeAddress(value)).toBeNull();
		}
	});

	it('keeps each address once, in order', () => {
		expect(
			normalizeAddresses(['B@x.test', 'b+1@x.test', 'nope', 'c@x.test']).map((entry) => entry.address)
		).toEqual(['b@x.test', 'c@x.test']);
	});

	it('normalizes subjects for threading', () => {
		expect(normalizeSubject('Re: RE[2]: Fwd:  Invoice   42 ')).toBe('invoice 42');
		expect(normalizeSubject('AW: SV: Hello')).toBe('hello');
		expect(normalizeSubject('Regarding the plan')).toBe('regarding the plan');
		expect(normalizeSubject(undefined)).toBe('');
	});

	it('applies a sender allowlist of addresses and domains (with subdomains)', () => {
		expect(isSenderAllowed([], 'anyone@x.test')).toBe(true);
		expect(isSenderAllowed(['boss@acme.test'], 'Boss <BOSS@acme.test>')).toBe(true);
		expect(isSenderAllowed(['@acme.test'], 'a@mail.acme.test')).toBe(true);
		expect(isSenderAllowed(['@acme.test'], 'a@notacme.test')).toBe(false);
		expect(isSenderAllowed(['boss@acme.test'], undefined)).toBe(false);
	});
});
