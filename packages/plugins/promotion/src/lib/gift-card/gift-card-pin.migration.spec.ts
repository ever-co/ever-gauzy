import { createHash } from 'crypto';
import { HashGiftCardPins1791000000785 } from '../migrations/1791000000785-HashGiftCardPins';
import { hashGiftCardPin, isGiftCardPinDigest, storedGiftCardPin } from './gift-card-pin';

/**
 * R2-G30: the PINs `POST /gift-cards` and `PUT /gift-cards/:id` stored in plaintext are turned into the digest the
 * balance lookup compares with, on every dialect, and the down leaves the digests in place.
 *
 * The runner is a double over an in-memory `gift_card` table that reads the dialect's own placeholders, so a statement
 * written with the wrong one for its dialect binds nothing and changes nothing.
 */

const digestOf = (pin: string) => createHash('sha256').update(pin).digest('hex');

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
					return rows.filter((row) => row.pin !== null && row.pin !== '').map((row) => ({ ...row }));
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
		expect(storedGiftCardPin(undefined)).toBeUndefined();
		expect(storedGiftCardPin(null)).toBeNull();
		expect(storedGiftCardPin('')).toBeNull();
		expect(storedGiftCardPin('1234')).toBe(digestOf('1234'));
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
