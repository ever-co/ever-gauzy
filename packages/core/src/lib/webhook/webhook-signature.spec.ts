import { createHmac } from 'node:crypto';
import {
	WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
	signWebhookPayload,
	verifyWebhookSignature
} from './webhook-signature';

/**
 * The outbound webhook signature, asserted against an independent computation of the same digest.
 *
 * The wire format is the whole contract between the platform and a receiver: `t=<unix-seconds>` and
 * `v1=<hex hmac-sha256>`, computed over `<t>.<raw body>`. Every case below recomputes the expected
 * digest here with `node:crypto` rather than reading it back from the module, so what is asserted is
 * what a receiver reproduces — not merely that the module agrees with itself. The properties that
 * matter are that the timestamp is *inside* the signed string (which is what makes the tolerance
 * window mean anything), that the body is signed over the bytes that were sent, and that a rotation
 * can hand out two signatures that both verify.
 */

const SECRET = 'whsec_test_fixture_2f8c1d';
const PREVIOUS_SECRET = 'whsec_test_fixture_9a4e';
const BODY = JSON.stringify({ type: 'order.placed', data: { orderId: 'a1b2', total: '199.90' } });
const TS = 1_700_000_000;

/** The digest a receiver computes from the documented canonical string. */
const expectedDigest = (secret: string, timestamp: number, body: string): string =>
	createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');

describe('the header a delivery carries', () => {
	it('is t=<unix-seconds>,v1=<hex hmac-sha256> over the timestamp and the body', () => {
		const signed = signWebhookPayload(SECRET, BODY, { timestamp: TS });

		expect(signed.timestamp).toBe(TS);
		expect(signed.header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
		expect(signed.header.split('v1=')[1]).toBe(expectedDigest(SECRET, TS, BODY));
	});

	it('signs the timestamp as part of the string, not beside it', () => {
		// Control: a signature computed over the body alone would still look right in the header and
		// would let a captured request be replayed with a fresh timestamp forever.
		const signed = signWebhookPayload(SECRET, BODY, { timestamp: TS });

		expect(signed.header.split('v1=')[1]).not.toBe(createHmac('sha256', SECRET).update(BODY, 'utf8').digest('hex'));
	});

	it('is deterministic for one payload at one second, and sensitive to every input', () => {
		const signed = signWebhookPayload(SECRET, BODY, { timestamp: TS });

		expect(signWebhookPayload(SECRET, BODY, { timestamp: TS }).header).toBe(signed.header);
		expect(signWebhookPayload(SECRET, `${BODY} `, { timestamp: TS }).header).not.toBe(signed.header);
		expect(signWebhookPayload(PREVIOUS_SECRET, BODY, { timestamp: TS }).header).not.toBe(signed.header);
		expect(signWebhookPayload(SECRET, BODY, { timestamp: TS + 1 }).header).not.toBe(signed.header);
	});

	it('signs a non-ASCII body over the bytes that were sent', () => {
		// A naive implementation re-serialises the payload and signs different bytes than the ones on
		// the wire, which a receiver verifying the raw body then rejects.
		const unicode = JSON.stringify({ name: 'Ünïcødé — 商品 — ₴199', emoji: '🔐' });
		const signed = signWebhookPayload(SECRET, unicode, { timestamp: TS });

		expect(signed.header.split('v1=')[1]).toBe(
			createHmac('sha256', SECRET).update(`${TS}.${unicode}`, 'utf8').digest('hex')
		);
		expect(verifyWebhookSignature(SECRET, unicode, signed.header, { now: TS })).toBe(true);
	});
});

describe('verifying a received signature', () => {
	const signed = signWebhookPayload(SECRET, BODY, { timestamp: TS });

	it('accepts a freshly signed payload, and one inside the window in either direction', () => {
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS })).toBe(true);
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS + 1 })).toBe(true);
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS - 1 })).toBe(true);
		// The window is inclusive at its edge, so a clock a few seconds apart is not a rejection.
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS + WEBHOOK_SIGNATURE_TOLERANCE_SECONDS })).toBe(
			true
		);
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS - WEBHOOK_SIGNATURE_TOLERANCE_SECONDS })).toBe(
			true
		);
	});

	it('states the tolerance window the platform publishes', () => {
		expect(WEBHOOK_SIGNATURE_TOLERANCE_SECONDS).toBe(300);
	});

	it('refuses a payload one second outside the window, in either direction', () => {
		expect(
			verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS + WEBHOOK_SIGNATURE_TOLERANCE_SECONDS + 1 })
		).toBe(false);
		expect(
			verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS - WEBHOOK_SIGNATURE_TOLERANCE_SECONDS - 1 })
		).toBe(false);
	});

	it('refuses a body that changed after it was signed', () => {
		// Control for every acceptance above: without this, a verifier that returned true unconditionally
		// would pass this suite.
		expect(verifyWebhookSignature(SECRET, BODY.replace('199.90', '1.00'), signed.header, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, `${BODY}x`, signed.header, { now: TS })).toBe(false);
	});

	it('refuses a signature presented under the wrong secret', () => {
		expect(verifyWebhookSignature(PREVIOUS_SECRET, BODY, signed.header, { now: TS })).toBe(false);
	});

	it('refuses a timestamp rewritten to escape the window, because the timestamp is signed', () => {
		const stale = signed.header.replace(`t=${TS}`, `t=${TS + 10_000}`);

		expect(verifyWebhookSignature(SECRET, BODY, stale, { now: TS + 10_000 })).toBe(false);
	});

	it('refuses a header it cannot read rather than guessing at one', () => {
		const digest = expectedDigest(SECRET, TS, BODY);

		expect(verifyWebhookSignature(SECRET, BODY, '', { now: TS })).toBe(false);
		expect(verifyWebhookSignature('', BODY, signed.header, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, `v1=${digest}`, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, `t=${TS}`, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, `t=not-a-number,v1=${digest}`, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, `t=${TS},v1=`, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, `t=${TS},v1=${digest.slice(0, 32)}`, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, `t=${TS},v1=${'0'.repeat(64)}`, { now: TS })).toBe(false);
	});

	it('honours a caller’s own window when one is supplied', () => {
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS + 60, toleranceSeconds: 30 })).toBe(false);
		expect(verifyWebhookSignature(SECRET, BODY, signed.header, { now: TS + 600, toleranceSeconds: 3_600 })).toBe(true);
	});
});

describe('a rotation', () => {
	const rotating = signWebhookPayload(SECRET, BODY, { timestamp: TS, previousSecret: PREVIOUS_SECRET });
	const signatures = rotating.header.split(',').filter((part) => part.startsWith('v1='));

	it('carries both secrets’ signatures, the current one first', () => {
		expect(signatures).toHaveLength(2);
		expect(signatures[0]).toBe(`v1=${expectedDigest(SECRET, TS, BODY)}`);
		expect(signatures[1]).toBe(`v1=${expectedDigest(PREVIOUS_SECRET, TS, BODY)}`);
	});

	it('lets a receiver that has either secret accept the message', () => {
		// This is what makes a rotation seamless: the endpoint can be reconfigured while deliveries
		// keep verifying under the secret it still holds.
		expect(verifyWebhookSignature(SECRET, BODY, rotating.header, { now: TS })).toBe(true);
		expect(verifyWebhookSignature(PREVIOUS_SECRET, BODY, rotating.header, { now: TS })).toBe(true);
		expect(verifyWebhookSignature('whsec_test_fixture_unrelated', BODY, rotating.header, { now: TS })).toBe(false);
	});

	it('does not weaken the body binding while both secrets are active', () => {
		expect(verifyWebhookSignature(SECRET, `${BODY}x`, rotating.header, { now: TS })).toBe(false);
		expect(verifyWebhookSignature(PREVIOUS_SECRET, `${BODY}x`, rotating.header, { now: TS })).toBe(false);
	});

	it('signs with the current secret alone when there is no previous one', () => {
		expect(signWebhookPayload(SECRET, BODY, { timestamp: TS }).header.split('v1=')).toHaveLength(2);
	});
});
