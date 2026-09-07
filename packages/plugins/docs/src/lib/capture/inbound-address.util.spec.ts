import {
	isSenderAllowedBy,
	normalizeInboundDomain,
	normalizeInboundLocalPart,
	normalizeRecipientAddress
} from './inbound-address.util';

/**
 * These functions decide **which tenant receives a message** and **whether a sender may write to
 * them**, so they are the security-critical half of inbound capture.
 *
 * The behaviour they replace had none of this covered: the old parser did `split('@')[0]` and
 * threw the domain away entirely, so `docs-<token>@attacker.example` resolved exactly as well as
 * the configured capture domain — and no test exercised it.
 */
describe('inbound address utils', () => {
	describe('normalizeRecipientAddress', () => {
		it('keeps the domain — the whole address identifies the tenant, not just the local part', () => {
			expect(normalizeRecipientAddress('docs-abc123@inbound.gauzy.co')).toBe('docs-abc123@inbound.gauzy.co');
			// Same local part, different domain ⇒ a DIFFERENT address. The old parser conflated these.
			expect(normalizeRecipientAddress('docs-abc123@attacker.example')).toBe('docs-abc123@attacker.example');
			expect(normalizeRecipientAddress('docs-abc123@inbound.gauzy.co')).not.toBe(
				normalizeRecipientAddress('docs-abc123@attacker.example')
			);
		});

		it('strips a +tag so a tagged delivery still reaches the same mailbox', () => {
			expect(normalizeRecipientAddress('docs+invoices@acme.com')).toBe('docs@acme.com');
			expect(normalizeRecipientAddress('docs+a+b@acme.com')).toBe('docs@acme.com');
		});

		it('unwraps a display-name form', () => {
			expect(normalizeRecipientAddress('"Docs Intake" <docs@acme.com>')).toBe('docs@acme.com');
			expect(normalizeRecipientAddress('Docs <DOCS+tag@ACME.com>')).toBe('docs@acme.com');
		});

		it('lower-cases, since addresses are stored and matched lower-case', () => {
			expect(normalizeRecipientAddress('  DOCS@ACME.COM  ')).toBe('docs@acme.com');
		});

		it('rejects anything that is not a usable address', () => {
			for (const bad of ['', '   ', 'no-at-sign', '@acme.com', 'docs@', 'docs @acme.com', 'docs@ac me.com']) {
				expect(normalizeRecipientAddress(bad)).toBeNull();
			}
			expect(normalizeRecipientAddress(undefined)).toBeNull();
		});

		it('splits on the last @, so an extra @ cannot smuggle a different domain', () => {
			// `a@b@evil.com` must resolve to domain `evil.com`, never `b`.
			expect(normalizeRecipientAddress('a@b@evil.com')).toBe('a@b@evil.com'.slice(0, 3) + '@evil.com');
		});
	});

	describe('normalizeInboundDomain', () => {
		it('accepts real domains and lower-cases them', () => {
			expect(normalizeInboundDomain('Acme.com')).toBe('acme.com');
			expect(normalizeInboundDomain('mail.acme.co.uk')).toBe('mail.acme.co.uk');
			expect(normalizeInboundDomain('@acme.com')).toBe('acme.com');
			expect(normalizeInboundDomain('acme.com.')).toBe('acme.com');
		});

		it('rejects shapes that would make routing ambiguous', () => {
			for (const bad of ['', 'acme', 'acme.', '.acme.com', 'acme..com', '-acme.com', 'acme-.com', 'acme.c', 'ac me.com']) {
				expect(normalizeInboundDomain(bad)).toBeNull();
			}
		});
	});

	describe('normalizeInboundLocalPart', () => {
		it('accepts ordinary mailbox names', () => {
			expect(normalizeInboundLocalPart('Docs')).toBe('docs');
			expect(normalizeInboundLocalPart('docs-intake')).toBe('docs-intake');
			expect(normalizeInboundLocalPart('docs.intake_2')).toBe('docs.intake_2');
		});

		it('rejects edge dots and anything exotic enough to make comparison ambiguous', () => {
			for (const bad of ['', '.docs', 'docs.', 'docs@acme', 'docs intake', 'docs/../etc']) {
				expect(normalizeInboundLocalPart(bad)).toBeNull();
			}
		});
	});

	describe('isSenderAllowedBy', () => {
		it('permits everything when the allowlist is empty or absent — the documented default', () => {
			expect(isSenderAllowedBy(null, 'anyone@example.com')).toBe(true);
			expect(isSenderAllowedBy([], 'anyone@example.com')).toBe(true);
			expect(isSenderAllowedBy(undefined, 'anyone@example.com')).toBe(true);
		});

		it('matches a full address', () => {
			expect(isSenderAllowedBy(['ceo@acme.com'], 'ceo@acme.com')).toBe(true);
			expect(isSenderAllowedBy(['ceo@acme.com'], 'CEO@Acme.com')).toBe(true);
			expect(isSenderAllowedBy(['ceo@acme.com'], 'intern@acme.com')).toBe(false);
		});

		it('matches a whole domain, written either way', () => {
			expect(isSenderAllowedBy(['@acme.com'], 'anyone@acme.com')).toBe(true);
			expect(isSenderAllowedBy(['acme.com'], 'anyone@acme.com')).toBe(true);
			expect(isSenderAllowedBy(['@acme.com'], 'anyone@other.com')).toBe(false);
		});

		it('compares domains exactly — a lookalike must not slip through', () => {
			expect(isSenderAllowedBy(['acme.com'], 'attacker@evil-acme.com')).toBe(false);
			expect(isSenderAllowedBy(['acme.com'], 'attacker@acme.com.evil.tld')).toBe(false);
			expect(isSenderAllowedBy(['acme.com'], 'attacker@sub.acme.com')).toBe(false);
		});

		it('does NOT strip a +tag from the sender — that would widen the rule', () => {
			// An operator allowing `ceo@acme.com` did not thereby allow every `ceo+*@acme.com`.
			expect(isSenderAllowedBy(['ceo@acme.com'], 'ceo+spoof@acme.com')).toBe(false);
		});

		it('fails closed when a non-empty allowlist is checked against no usable sender', () => {
			expect(isSenderAllowedBy(['ceo@acme.com'], undefined)).toBe(false);
			expect(isSenderAllowedBy(['ceo@acme.com'], '')).toBe(false);
			expect(isSenderAllowedBy(['ceo@acme.com'], 'not-an-address')).toBe(false);
		});

		it('ignores blank entries rather than treating them as a wildcard', () => {
			expect(isSenderAllowedBy(['', '   '], 'anyone@example.com')).toBe(false);
			expect(isSenderAllowedBy(['', 'acme.com'], 'someone@acme.com')).toBe(true);
		});
	});
});
