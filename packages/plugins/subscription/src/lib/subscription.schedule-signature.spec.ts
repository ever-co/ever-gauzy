import { signScheduledChange, verifyScheduledChange } from './subscription.schedule-signature';

describe('the signature on a change scheduled for the next period', () => {
	const env = { ENCRYPTION_KEY: 'a-deployment-secret-for-this-spec' };
	const change = {
		planId: 'plan-2',
		quantity: '2',
		effectiveAt: '2026-04-01T00:00:00.000Z',
		items: [{ variantId: 'variant-b', quantity: '2', unitPrice: '15.500000', position: 1 }]
	};

	it('verifies what it signed, whatever order the database hands the keys back in', () => {
		const signature = signScheduledChange('subscription-1', change, env);
		// `jsonb` and MySQL `JSON` store an object with its keys in an order of their own.
		const reordered = {
			signature,
			items: [{ position: 1, unitPrice: '15.500000', quantity: '2', variantId: 'variant-b' }],
			effectiveAt: '2026-04-01T00:00:00.000Z',
			quantity: '2',
			planId: 'plan-2'
		};

		expect(verifyScheduledChange('subscription-1', reordered, env)).toBe(true);
	});

	it('refuses a change edited after it was signed, copied onto another subscription, or signed under another key', () => {
		const signature = signScheduledChange('subscription-1', change, env);
		const unkeyed = signScheduledChange('subscription-1', change, {});

		expect(verifyScheduledChange('subscription-1', { ...change, quantity: '20', signature }, env)).toBe(false);
		expect(verifyScheduledChange('subscription-2', { ...change, signature }, env)).toBe(false);
		expect(verifyScheduledChange('subscription-1', { ...change, signature: unkeyed }, env)).toBe(false);
		expect(verifyScheduledChange('subscription-1', { ...change, signature: 'not-hex' }, env)).toBe(false);
		expect(verifyScheduledChange('subscription-1', change, env)).toBe(false);
	});

	it('keeps verifying a change signed under JWT_SECRET once ENCRYPTION_KEY is added', () => {
		const before = { JWT_SECRET: 'a-jwt-secret-for-this-spec' };
		const signature = signScheduledChange('subscription-1', change, before);

		expect(verifyScheduledChange('subscription-1', { ...change, signature }, { ...before, ...env })).toBe(true);
	});
});
