// cspell:ignore Ijoxf
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readJwsPayload, signCompactJws } from './compact-jws';

/** A file of the contracts package's fixtures (`@ever-co/connect-contracts/fixtures/...`). */
const fixture = (path: string): string =>
	readFileSync(
		join(dirname(require.resolve('@ever-co/connect-contracts/package.json')), 'fixtures', path),
		'utf8'
	).trim();

describe('compact JWS helpers', () => {
	it('signs a compact EdDSA JWS that Ed25519 verifies over its signing input', async () => {
		const { privateKey, publicKey } = generateKeyPairSync('ed25519');
		const token = await signCompactJws(
			(bytes) => new Uint8Array(sign(null, Buffer.from(bytes), privateKey)),
			{ typ: 'ever-stats-link+jwt' },
			{ sub: 'inst_1', iat: 1700000000 }
		);
		const [header, payload, signature] = token.split('.');
		expect(JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))).toEqual({
			alg: 'EdDSA',
			typ: 'ever-stats-link+jwt'
		});
		expect(readJwsPayload(token)).toEqual({ sub: 'inst_1', iat: 1700000000 });
		expect(verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))).toBe(
			true
		);
	});

	it('reads the claims of the SDK fixture entitlement documents', () => {
		for (const name of ['instance', 'link']) {
			expect(readJwsPayload(fixture(`entitlement/valid/${name}.jws`))).toEqual(
				JSON.parse(fixture(`entitlement/valid/${name}.claims.json`))
			);
		}
	});

	it.each([
		['not a string', 42],
		['two parts', 'a.b'],
		['four parts', 'a.b.c.d'],
		['an empty part', 'a..c'],
		['padding', 'eyJhIjoxfQ==.eyJhIjoxfQ==.c2ln'],
		['a payload that is not JSON', `e30.${Buffer.from('nope').toString('base64url')}.c2ln`],
		['a payload that is an array', `e30.${Buffer.from('[1]').toString('base64url')}.c2ln`],
		['a document past 64 KiB', `e30.${'a'.repeat(65536)}.c2ln`]
	])('reads nothing from %s', (_label, token) => {
		expect(readJwsPayload(token)).toBeNull();
	});
});
