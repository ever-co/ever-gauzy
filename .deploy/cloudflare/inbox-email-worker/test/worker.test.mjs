// cspell:ignore authserv
// node --test .deploy/cloudflare/inbox-email-worker/test
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
	deliver,
	hmacSha256Hex,
	INBOUND_PATH,
	settingsOf,
	SIGNATURE_HEADER,
	toBase64,
	trustedAuthenticationResults
} from '../src/worker.mjs';

const SECRET = 'a-platform-secret-of-enough-length';
const ENV = { GAUZY_INBOX_API_URL: 'https://api.example.com/', GAUZY_INBOX_PLATFORM_SECRET: SECRET };
const RAW = [
	'Authentication-Results: mx.cloudflare.net; spf=pass smtp.mailfrom=acme.test; dkim=pass header.d=acme.test;',
	' dmarc=pass header.from=acme.test',
	'Authentication-Results: forged.example; dmarc=pass',
	'From: Ada <ada@acme.test>',
	'To: support.acme@inbox.example.com',
	'Message-ID: <m-1@acme.test>',
	'Subject: Hello',
	'',
	'Hi.',
	''
].join('\r\n');

/** Cloudflare's `ForwardableEmailMessage`, as far as the Worker reads it. */
function message(raw = RAW, overrides = {}) {
	const bytes = new TextEncoder().encode(raw);
	const rejected = [];
	return {
		from: 'bounce@acme.test',
		to: 'support.acme@inbox.example.com',
		raw: new Response(bytes).body,
		rawSize: bytes.length,
		setReject: (reason) => rejected.push(reason),
		rejected,
		...overrides
	};
}

function api(status, body = { accepted: 1, duplicates: 0, dropped: 0 }) {
	const calls = [];
	const fetcher = async (url, init) => {
		calls.push({ url, init });
		return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	};
	return { calls, fetcher };
}

describe('Gauzy Inbox Cloudflare Email Worker', () => {
	it('posts the raw message, the envelope and Cloudflare’s verdicts, signed as the API verifies', async () => {
		const { calls, fetcher } = api(202);
		const incoming = message();
		const result = await deliver(incoming, ENV, fetcher);
		assert.equal(result.outcome, 'accepted');
		assert.deepEqual(incoming.rejected, []);
		const [{ url, init }] = calls;
		assert.equal(url, `https://api.example.com${INBOUND_PATH}`);
		const body = JSON.parse(init.body);
		assert.equal(Buffer.from(body.raw, 'base64').toString(), RAW);
		assert.deepEqual(body.envelope, { from: 'bounce@acme.test', to: ['support.acme@inbox.example.com'] });
		assert.match(
			body.authenticationResults,
			/^mx\.cloudflare\.net; spf=pass .* dmarc=pass header\.from=acme\.test$/
		);
		// The API's scheme (core `verifyWebhookSignature`): HMAC-SHA256 of "<t>.<body>".
		const [, t, v1] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(init.headers[SIGNATURE_HEADER]);
		assert.equal(v1, createHmac('sha256', SECRET).update(`${t}.${init.body}`).digest('hex'));
	});

	it('forwards only the receiving MX’s verdicts, never a sender’s', () => {
		const bytes = (text) => new TextEncoder().encode(text);
		assert.equal(
			trustedAuthenticationResults(bytes('Authentication-Results: forged.example; dmarc=pass\r\n\r\nx')),
			undefined
		);
		assert.equal(
			trustedAuthenticationResults(
				bytes('ARC-Authentication-Results: i=1; mx.cloudflare.net; dmarc=fail\r\nFrom: a@b.test\r\n\r\nx')
			),
			'mx.cloudflare.net; dmarc=fail'
		);
		assert.equal(
			trustedAuthenticationResults(
				bytes('From: a@b.test\r\n\r\nAuthentication-Results: mx.cloudflare.net; dmarc=pass')
			),
			undefined
		);
		assert.equal(
			trustedAuthenticationResults(
				bytes('Authentication-Results: mx.other.test; dmarc=pass\r\n\r\nx'),
				'mx.other.test'
			),
			'mx.other.test; dmarc=pass'
		);
	});

	it('reads the topmost authentication header of either kind (the MX prepends its own)', () => {
		const bytes = (text) => new TextEncoder().encode(text);
		// The MX's ARC verdict above an earlier hop's Authentication-Results.
		assert.equal(
			trustedAuthenticationResults(
				bytes(
					'ARC-Authentication-Results: i=2; mx.cloudflare.net; dmarc=pass\r\n' +
						'Authentication-Results: relay.example; dmarc=fail\r\n\r\nx'
				)
			),
			'mx.cloudflare.net; dmarc=pass'
		);
		// The MX's direct header above an earlier ARC set.
		assert.equal(
			trustedAuthenticationResults(
				bytes(
					'Authentication-Results: mx.cloudflare.net; dmarc=pass\r\n' +
						'ARC-Authentication-Results: i=1; relay.example; dmarc=fail\r\n\r\nx'
				)
			),
			'mx.cloudflare.net; dmarc=pass'
		);
		// A trusted-looking header below an untrusted topmost one is never read.
		assert.equal(
			trustedAuthenticationResults(
				bytes(
					'Authentication-Results: relay.example; dmarc=fail\r\n' +
						'ARC-Authentication-Results: i=1; mx.cloudflare.net; dmarc=pass\r\n\r\nx'
				)
			),
			undefined
		);
	});

	it('acknowledges only the API’s own delivery result; anything else is retried', async () => {
		for (const [status, body] of [
			[200, { accepted: 1, duplicates: 0, dropped: 0 }],
			[202, { ok: true }],
			[202, { accepted: '1', duplicates: 0, dropped: 0 }]
		]) {
			const kept = message();
			await assert.rejects(deliver(kept, ENV, api(status, body).fetcher), /without a delivery result/);
			assert.deepEqual(kept.rejected, []);
		}
		const html = message();
		const page = async () =>
			new Response('<html>ok</html>', { status: 202, headers: { 'content-type': 'text/html' } });
		await assert.rejects(deliver(html, ENV, page), /without a delivery result/);
		// And never follows a redirect with the signed message.
		const { calls, fetcher } = api(202);
		await deliver(message(), ENV, fetcher);
		assert.equal(calls[0].init.redirect, 'error');
	});

	it('rejects an oversized message before reading it, and a delivery no mailbox took', async () => {
		const big = api(202);
		const oversized = message(RAW, { rawSize: 26 * 1024 * 1024 });
		assert.equal((await deliver(oversized, ENV, big.fetcher)).outcome, 'rejected');
		assert.deepEqual(oversized.rejected, ['Message too large']);
		assert.equal(big.calls.length, 0);

		const nobody = message();
		await deliver(nobody, ENV, api(202, { accepted: 0, duplicates: 0, dropped: 1 }).fetcher);
		assert.deepEqual(nobody.rejected, ['No such mailbox']);
		// A duplicate is fine (the first delivery was stored).
		const again = message();
		await deliver(again, ENV, api(202, { accepted: 0, duplicates: 1, dropped: 0 }).fetcher);
		assert.deepEqual(again.rejected, []);
	});

	it('rejects definite refusals, and throws (the sender retries) on configuration and transient errors', async () => {
		const tooLarge = message();
		await deliver(tooLarge, ENV, api(413, { message: 'too large' }).fetcher);
		assert.deepEqual(tooLarge.rejected, ['Message too large']);
		const bad = message();
		await deliver(bad, ENV, api(400, { message: 'bad' }).fetcher);
		assert.deepEqual(bad.rejected, ['Refused by the inbox (400)']);
		for (const status of [401, 404, 429, 500, 503]) {
			const kept = message();
			await assert.rejects(deliver(kept, ENV, api(status, {}).fetcher), /retries later/);
			assert.deepEqual(kept.rejected, []);
		}
		await assert.rejects(
			deliver(message(), ENV, async () => {
				throw new TypeError('network down');
			}),
			/network down/
		);
	});

	it('refuses to run without its settings (the sender retries while they are fixed)', () => {
		assert.throws(() => settingsOf({ GAUZY_INBOX_PLATFORM_SECRET: SECRET }), /GAUZY_INBOX_API_URL/);
		assert.throws(
			() => settingsOf({ GAUZY_INBOX_API_URL: 'http://api.example.com', GAUZY_INBOX_PLATFORM_SECRET: SECRET }),
			/https/
		);
		assert.throws(
			() => settingsOf({ GAUZY_INBOX_API_URL: 'https://api.example.com', GAUZY_INBOX_PLATFORM_SECRET: 'short' }),
			/PLATFORM_SECRET/
		);
		assert.equal(settingsOf({ ...ENV, GAUZY_INBOX_MAX_MESSAGE_BYTES: '1000' }).maxBytes, 1000);
	});

	it('encodes and signs with the platform primitives', async () => {
		assert.equal(toBase64(new Uint8Array([0, 255, 104, 105])), Buffer.from([0, 255, 104, 105]).toString('base64'));
		assert.equal(await hmacSha256Hex('k', 'v'), createHmac('sha256', 'k').update('v').digest('hex'));
	});
});
