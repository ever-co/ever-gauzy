import {
	chosenLocalPart,
	employeeName,
	isWithinDomain,
	normalizeDomain,
	platformLocalPart,
	slugSegment
} from './mailbox-address';

describe('mailbox addresses (allocation)', () => {
	it('slugs names: accents folded, everything else a dash, bounded', () => {
		expect(slugSegment('Ruslan Konviser')).toBe('ruslan-konviser');
		expect(slugSegment('Zoë Ångström')).toBe('zoe-angstrom');
		expect(slugSegment('  --Ever Co., LTD!  ')).toBe('ever-co-ltd');
		expect(slugSegment('x'.repeat(40))).toHaveLength(24);
		expect(slugSegment('日本')).toBe('');
	});

	it('builds <name>.<orgSlug> with a numeric suffix on a collision', () => {
		expect(platformLocalPart('ada.lovelace', 'acme')).toBe('ada.lovelace.acme');
		expect(platformLocalPart('ada.lovelace', 'acme', 2)).toBe('ada.lovelace2.acme');
		expect(platformLocalPart('support', 'acme', 10)).toBe('support10.acme');
		expect(platformLocalPart('', 'acme')).toBeNull();
		// Never longer than 64 characters.
		expect(platformLocalPart('a'.repeat(80), 'acme')?.length).toBe(64);
	});

	it('names employees <first>.<last>, else by their email', () => {
		expect(employeeName('Ada', 'Lovelace')).toBe('ada.lovelace');
		expect(employeeName('Ada', null)).toBe('ada');
		expect(employeeName(null, null, 'a.l+x@acme.test')).toBe('a-l-x');
		expect(employeeName(null, null, null)).toBe('employee');
	});

	it('takes chosen local parts and domains in their plain form only', () => {
		expect(chosenLocalPart('Sales.EU')).toBe('sales.eu');
		expect(chosenLocalPart('a..b')).toBeNull();
		expect(chosenLocalPart('-a')).toBeNull();
		expect(chosenLocalPart('a b')).toBeNull();
		expect(normalizeDomain('Mail.Acme.Test.')).toBe('mail.acme.test');
		expect(normalizeDomain('localhost')).toBeNull();
		expect(normalizeDomain('acme..test')).toBeNull();
		expect(isWithinDomain('x.inbox.example.test', 'inbox.example.test')).toBe(true);
		expect(isWithinDomain('other-inbox.example.test', 'inbox.example.test')).toBe(false);
	});
});
