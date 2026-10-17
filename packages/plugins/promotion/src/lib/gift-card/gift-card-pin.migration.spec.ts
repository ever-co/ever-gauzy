// cspell:ignore changeme
import { createHash } from 'crypto';
import { HashGiftCardPins1791000000785 } from '../migrations/1791000000785-HashGiftCardPins';
import { KeyGiftCardPinDigests1791000000786 } from '../migrations/1791000000786-KeyGiftCardPinDigests';
import {
	hashGiftCardPin,
	isGiftCardPinDigest,
	isKeyedGiftCardPin,
	keyGiftCardPinDigest,
	storedGiftCardPin,
	verifyGiftCardPin
} from './gift-card-pin';

/**
 * R2-G30: the PINs `POST /gift-cards` and `PUT /gift-cards/:id` stored in plaintext are turned into the digest the
 * balance lookup compares with, on every dialect, and the down leaves the digests in place.
 *
 * The runner is a double over an in-memory `gift_card` table that reads the dialect's own placeholders, so a statement
 * written with the wrong one for its dialect binds nothing and changes nothing.
 */

const digestOf = (pin: string) => createHash('sha256').update(pin).digest('hex');

/** An environment with the platform's at-rest secret configured. */
const KEYED_ENV = { ENCRYPTION_KEY: 'suite-encryption-key-for-gift-card-pins' };

interface IRow {
	id: string;
	pin: string | null;
}

function runnerOver(type: string, rows: IRow[], options: { hasTable?: boolean } = {}) {
	const statements: Array<{ sql: string; parameters?: unknown[] }> = [];

	return {
		statements,
		runner: {
			connection: { options: { type } },
			hasTable: async (name: string) => (options.hasTable ?? true) && name === 'gift_card',
			query: async (sql: string, parameters?: unknown[]) => {
				statements.push({ sql, parameters });

				if (/^SELECT/i.test(sql)) {
					// What the statement asks for, read as MySQL's PAD SPACE collation reads it: trailing spaces do
					// not count, so a `pin <> ''` condition would also drop a PIN made of spaces.
					const padSpace = (value: string) => value.replace(/ +$/, '');
					const excludesEmpty = /<>\s*''/.test(sql);

					return rows
						.filter((row) => row.pin !== null && !(excludesEmpty && padSpace(row.pin) === ''))
						.map((row) => ({ ...row }));
				}

				const placeholders = type === 'postgres' ? ['$1', '$2', '$3'] : ['?', '?', '?'];
				const expected =
					type === 'mysql'
						? `UPDATE \`gift_card\` SET \`pin\` = ${placeholders[0]} WHERE \`id\` = ${placeholders[1]} AND \`pin\` = ${placeholders[2]}`
						: `UPDATE "gift_card" SET "pin" = ${placeholders[0]} WHERE "id" = ${placeholders[1]} AND "pin" = ${placeholders[2]}`;

				if (sql !== expected) {
					throw new Error(`unexpected statement for ${type}: ${sql}`);
				}

				const [pin, id, previous] = parameters as [string, string, string];
				const row = rows.find((one) => one.id === id && one.pin === previous);

				if (row) {
					row.pin = pin;
				}

				return [];
			}
		}
	};
}

describe('the gift-card PIN form (R2-G30)', () => {
	it('hashes a PIN as stated, and tells a digest from a plaintext PIN', () => {
		expect(hashGiftCardPin('4821')).toBe(digestOf('4821'));
		expect(hashGiftCardPin(' 4821')).not.toBe(digestOf('4821'));
		expect(isGiftCardPinDigest(digestOf('4821'))).toBe(true);
		expect(isGiftCardPinDigest(digestOf('4821').toUpperCase())).toBe(true);
		expect(isGiftCardPinDigest('4821')).toBe(false);
		expect(isGiftCardPinDigest(null)).toBe(false);
	});

	it('stores nothing for an absent PIN, no second factor for null or blank, and the digest otherwise', () => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(storedGiftCardPin(undefined, {})).toBeUndefined();
		expect(storedGiftCardPin(null, {})).toBeNull();
		expect(storedGiftCardPin('', {})).toBeNull();
		// With no secret configured the legacy digest is what can be stored (R2-G30b keys it when there is one).
		expect(storedGiftCardPin('1234', {})).toBe(digestOf('1234'));
		expect(storedGiftCardPin('1234', KEYED_ENV)).toBe(keyGiftCardPinDigest(digestOf('1234'), KEYED_ENV));

		jest.restoreAllMocks();
	});
});

describe('HashGiftCardPins1791000000785', () => {
	it.each(['postgres', 'mysql', 'sqlite', 'better-sqlite3'])(
		'replaces each plaintext PIN with its digest and leaves digests and empty PINs alone on %s',
		async (type) => {
			const rows: IRow[] = [
				{ id: 'gc-plain', pin: '4821' },
				{ id: 'gc-hashed', pin: digestOf('1111') },
				{ id: 'gc-none', pin: null },
				{ id: 'gc-blank', pin: '' }
			];
			const { runner } = runnerOver(type, rows);

			await new HashGiftCardPins1791000000785().up(runner as never);

			expect(rows).toEqual([
				{ id: 'gc-plain', pin: digestOf('4821') },
				{ id: 'gc-hashed', pin: digestOf('1111') },
				{ id: 'gc-none', pin: null },
				{ id: 'gc-blank', pin: '' }
			]);
		}
	);

	it('hashes a PIN made of spaces, which a PAD SPACE collation compares equal to the empty string', async () => {
		const rows: IRow[] = [{ id: 'gc-spaces', pin: '   ' }];
		const { runner } = runnerOver('mysql', rows);

		await new HashGiftCardPins1791000000785().up(runner as never);

		expect(rows[0].pin).toBe(digestOf('   '));
	});

	it('leaves a keyed digest alone, should the tick run after the code wrote one (R2-G30b)', async () => {
		const keyed = keyGiftCardPinDigest(digestOf('4821'), KEYED_ENV) as string;
		const rows: IRow[] = [{ id: 'gc-keyed', pin: keyed }];
		const { runner } = runnerOver('postgres', rows);

		await new HashGiftCardPins1791000000785().up(runner as never);

		expect(rows[0].pin).toBe(keyed);
	});

	it('is idempotent: a second run finds nothing left to hash', async () => {
		const rows: IRow[] = [{ id: 'gc-plain', pin: '4821' }];
		const first = runnerOver('postgres', rows);

		await new HashGiftCardPins1791000000785().up(first.runner as never);
		const second = runnerOver('postgres', rows);
		await new HashGiftCardPins1791000000785().up(second.runner as never);

		expect(rows[0].pin).toBe(digestOf('4821'));
		expect(second.statements.filter((one) => /^UPDATE/i.test(one.sql))).toHaveLength(0);
	});

	it('does nothing where the table does not exist', async () => {
		const { runner, statements } = runnerOver('postgres', [], { hasTable: false });

		await new HashGiftCardPins1791000000785().up(runner as never);

		expect(statements).toHaveLength(0);
	});

	it.each(['postgres', 'mysql', 'sqlite'])('keeps the digests on the way down on %s', async (type) => {
		const rows: IRow[] = [{ id: 'gc-hashed', pin: digestOf('4821') }];
		const { runner, statements } = runnerOver(type, rows);

		await new HashGiftCardPins1791000000785().down(runner as never);

		expect(statements).toHaveLength(0);
		expect(rows[0].pin).toBe(digestOf('4821'));
	});
});

/**
 * R2-G30b: the keyed form, and the tick that converts every legacy digest to it without the plaintext.
 */
describe('the keyed gift-card PIN form (R2-G30b)', () => {
	beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('is an HMAC over the legacy digest, under a key of the configured secret, tagged with its source and key id', () => {
		const keyed = keyGiftCardPinDigest(digestOf('4821'), KEYED_ENV) as string;

		expect(keyed).toMatch(/^h1:k:[0-9a-f]{8}:[0-9a-f]{64}$/);
		expect(isKeyedGiftCardPin(keyed)).toBe(true);
		expect(keyed).not.toContain(digestOf('4821'));
		// Another secret, another digest: a dump without the secret cannot be searched by digesting PINs.
		expect(keyGiftCardPinDigest(digestOf('4821'), { ENCRYPTION_KEY: 'another-secret' })).not.toBe(keyed);
		expect(keyGiftCardPinDigest(digestOf('4821'), { JWT_SECRET: 'a-strong-unique-jwt-secret' })).toMatch(/^h1:j:/);
	});

	it('is never keyed under no secret, or under one published in the repository', () => {
		expect(keyGiftCardPinDigest(digestOf('4821'), {})).toBeNull();
		expect(keyGiftCardPinDigest(digestOf('4821'), { JWT_SECRET: 'secretKey' })).toBeNull();
		expect(keyGiftCardPinDigest(digestOf('4821'), { ENCRYPTION_KEY: 'changeme' })).toBeNull();
	});

	it('verifies the keyed form and the legacy one, and asks for the legacy one to be keyed', () => {
		const keyed = keyGiftCardPinDigest(digestOf('4821'), KEYED_ENV) as string;

		expect(verifyGiftCardPin('4821', keyed, KEYED_ENV)).toEqual({ matches: true });
		expect(verifyGiftCardPin('4822', keyed, KEYED_ENV)).toEqual({ matches: false });
		expect(verifyGiftCardPin(undefined, keyed, KEYED_ENV)).toEqual({ matches: false });
		expect(verifyGiftCardPin('4821', digestOf('4821'), KEYED_ENV)).toEqual({ matches: true, upgrade: keyed });
		expect(verifyGiftCardPin('4821', digestOf('4821').toUpperCase(), KEYED_ENV)).toEqual({
			matches: true,
			upgrade: keyed
		});
		// A plaintext PIN is never compared as stated.
		expect(verifyGiftCardPin('4821', '4821', KEYED_ENV)).toEqual({ matches: false });
		// Without the secret the keyed form cannot verify; it is not mistaken for a legacy digest either.
		expect(verifyGiftCardPin('4821', keyed, {})).toEqual({ matches: false });
	});
});

describe('KeyGiftCardPinDigests1791000000786', () => {
	beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it.each(['postgres', 'mysql', 'sqlite', 'better-sqlite3'])(
		'keys every legacy digest from what is stored, on %s, and leaves keyed and empty PINs alone',
		async (type) => {
			const already = keyGiftCardPinDigest(digestOf('9999'), KEYED_ENV) as string;
			const rows: IRow[] = [
				{ id: 'gc-legacy', pin: digestOf('4821') },
				{ id: 'gc-upper', pin: digestOf('1111').toUpperCase() },
				{ id: 'gc-keyed', pin: already },
				{ id: 'gc-plain', pin: '2468' },
				{ id: 'gc-spaces', pin: '   ' },
				{ id: 'gc-none', pin: null },
				{ id: 'gc-blank', pin: '' }
			];
			const { runner } = runnerOver(type, rows);

			await new KeyGiftCardPinDigests1791000000786(KEYED_ENV).up(runner as never);

			expect(rows).toEqual([
				{ id: 'gc-legacy', pin: keyGiftCardPinDigest(digestOf('4821'), KEYED_ENV) },
				{ id: 'gc-upper', pin: keyGiftCardPinDigest(digestOf('1111'), KEYED_ENV) },
				{ id: 'gc-keyed', pin: already },
				{ id: 'gc-plain', pin: keyGiftCardPinDigest(digestOf('2468'), KEYED_ENV) },
				{ id: 'gc-spaces', pin: keyGiftCardPinDigest(digestOf('   '), KEYED_ENV) },
				{ id: 'gc-none', pin: null },
				{ id: 'gc-blank', pin: '' }
			]);

			// Every converted card verifies with the PIN its holder was given.
			expect(verifyGiftCardPin('4821', rows[0].pin as string, KEYED_ENV).matches).toBe(true);
			expect(verifyGiftCardPin('1111', rows[1].pin as string, KEYED_ENV).matches).toBe(true);
		}
	);

	it('is idempotent', async () => {
		const rows: IRow[] = [{ id: 'gc-legacy', pin: digestOf('4821') }];

		await new KeyGiftCardPinDigests1791000000786(KEYED_ENV).up(runnerOver('postgres', rows).runner as never);
		const second = runnerOver('postgres', rows);
		await new KeyGiftCardPinDigests1791000000786(KEYED_ENV).up(second.runner as never);

		expect(rows[0].pin).toBe(keyGiftCardPinDigest(digestOf('4821'), KEYED_ENV));
		expect(second.statements.filter((one) => /^UPDATE/i.test(one.sql))).toHaveLength(0);
	});

	it('converts nothing, and says so, when no usable secret is configured', async () => {
		const rows: IRow[] = [{ id: 'gc-legacy', pin: digestOf('4821') }];
		const { runner, statements } = runnerOver('postgres', rows);

		await new KeyGiftCardPinDigests1791000000786({ JWT_SECRET: 'secretKey' }).up(runner as never);

		expect(rows[0].pin).toBe(digestOf('4821'));
		expect(statements).toHaveLength(0);
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no gift-card PIN digest was keyed'));
	});

	it('does nothing where the table does not exist', async () => {
		const { runner, statements } = runnerOver('postgres', [], { hasTable: false });

		await new KeyGiftCardPinDigests1791000000786(KEYED_ENV).up(runner as never);

		expect(statements).toHaveLength(0);
	});

	it.each(['postgres', 'mysql', 'sqlite'])('keeps the keyed digests on the way down on %s', async (type) => {
		const keyed = keyGiftCardPinDigest(digestOf('4821'), KEYED_ENV) as string;
		const rows: IRow[] = [{ id: 'gc-keyed', pin: keyed }];
		const { runner, statements } = runnerOver(type, rows);

		await new KeyGiftCardPinDigests1791000000786(KEYED_ENV).down(runner as never);

		expect(statements).toHaveLength(0);
		expect(rows[0].pin).toBe(keyed);
	});
});
