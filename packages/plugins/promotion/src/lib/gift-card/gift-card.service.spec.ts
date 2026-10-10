import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, RequestContext } from '@gauzy/core';
import { GiftCardService } from './gift-card.service';
import { GiftCardTransactionService } from '../gift-card-transaction/gift-card-transaction.service';
import { GiftCardStatus, GiftCardTransactionType } from '../promotion.types';

/**
 * Gift cards: stored value with its own ledger.
 *
 * Every case is written against one of the invariants the domain states (doc 08 §13.3), because a
 * gift card is somebody's money and the interesting failures are all arithmetic:
 *
 * - `GC1` the materialised balance and the ledger agree, after any sequence of movements;
 * - `GC2` the balance never goes below zero and never above the face value unless an `ADJUST` put it
 *   there;
 * - a redemption is `min(balance, outstanding)`, so a card can never overpay an order — a partial
 *   redemption leaves the residual and an exact one closes the card, and a redemption larger than
 *   the balance is partly applied rather than refused;
 * - a refund restores exactly what the card paid and never more, so a replay cannot turn a card into
 *   a money machine;
 * - no conversion, ever: a card of another currency is refused outright, and a refused redemption
 *   leaves no ledger row.
 *
 * The service is constructed with an in-memory double of its repository and the real ledger service
 * over a double of its own; nothing touches a database, a network or the wall clock.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000080';

const AT = new Date('2026-01-15T12:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');

interface IGiftCardRow {
	id: string;
	tenantId: string;
	organizationId: string;
	code: string;
	initialAmount: string;
	balance: string;
	currency: string;
	status: GiftCardStatus;
	expiresAt?: Date;
	pin?: string;
	metadata?: Record<string, unknown>;
	customerId?: string;
	orderId?: string;
}

interface ILedgerRow {
	id: string;
	tenantId: string;
	organizationId: string;
	giftCardId: string;
	orderId?: string;
	amount: string;
	balanceAfter: string;
	type: GiftCardTransactionType;
	note?: string;
	occurredAt: Date;
}

const giftCard = (overrides: Partial<IGiftCardRow> & { id: string; code: string }): IGiftCardRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	initialAmount: '100.000000',
	balance: '100.000000',
	currency: 'USD',
	status: GiftCardStatus.ACTIVE,
	pin: undefined,
	...overrides
});

function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		const value = fields[field];

		if (expected instanceof FindOperator) {
			switch (expected.type) {
				case 'in':
					return (expected.value as unknown[]).some((one) => same(one, value));
				case 'isNull':
					return value === null || value === undefined;
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || same(expected, value);
	});
}

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * What a write addresses, as a conditions object.
 *
 * Every write of these services is scoped to the caller's tenant, so the criteria that reaches the
 * repository is `{ id, tenantId }` rather than a bare identifier — which is the whole point of the
 * scoping: a statement that names only an identifier is one another tenant's identifier can satisfy.
 * A double that understood only the identifier form would report a scoped write as having changed a
 * row it never matched.
 *
 * @param criteria What the service addressed the row by.
 * @returns The same thing as a conditions object.
 */
function criteriaOf(criteria: unknown): Record<string, unknown> {
	if (typeof criteria === 'string' || typeof criteria === 'number') {
		return { id: criteria };
	}

	return (criteria ?? {}) as Record<string, unknown>;
}

/** How the double's storage behaves, beyond holding the rows. */
interface IStorageOptions {
	/**
	 * The dialect the transaction reports. `postgres` honours `FOR UPDATE` as the database does: a
	 * transaction that asks for a row another one holds waits until that one ends. `sqlite` takes no row
	 * lock at all and runs transactions side by side, which is stricter than SQLite itself (whose single
	 * writer serialises them) and leaves the conditional write as the only guard.
	 */
	dialect?: 'postgres' | 'sqlite';
	/** The card's balance write throws. */
	failCardWrite?: boolean;
	/** The ledger insert throws. */
	failLedgerInsert?: boolean;
	/** Every conditional balance write matches no row, as if another writer always got there first. */
	alwaysContended?: boolean;
}

/**
 * @param cards The `gift_card` rows.
 * @param storage How the storage behaves.
 * @returns The service, the cards, the ledger and the events the movements produced.
 */
function serviceUnderTest(cards: IGiftCardRow[], storage: IStorageOptions = {}) {
	const ledger: ILedgerRow[] = [];
	const published: unknown[] = [];
	const dialect = storage.dialect ?? 'postgres';
	let ledgerSequence = 0;

	/** The rows held under `FOR UPDATE`, each with the promise that settles when its holder ends. */
	const rowLocks = new Map<string, Promise<void>>();

	/**
	 * Takes the row lock for a transaction, waiting for whichever transaction holds it to end first.
	 *
	 * @param id The row to lock.
	 * @param held The transaction's own locks, released when it ends.
	 */
	const acquire = async (id: string, held: Array<() => void>): Promise<void> => {
		while (rowLocks.has(id)) {
			await rowLocks.get(id);
		}

		let release: () => void = () => undefined;
		rowLocks.set(id, new Promise<void>((resolve) => (release = resolve)));
		held.push(() => {
			rowLocks.delete(id);
			release();
		});
	};

	/**
	 * The manager a transaction is handed: every write is undone if the transaction fails, and a row
	 * read `FOR UPDATE` stays locked until it ends. Reads hand back detached copies, as TypeORM does.
	 *
	 * @param undo The transaction's undo log.
	 * @param held The transaction's row locks.
	 */
	const transactionalManager = (undo: Array<() => void>, held: Array<() => void>) => ({
		connection: { options: { type: dialect } },
		createQueryBuilder: () => {
			let where: Record<string, unknown> = {};
			let locked = false;
			const builder = {
				where: (conditions: Record<string, unknown>) => {
					where = conditions;

					return builder;
				},
				setLock: (mode: string) => {
					locked = mode === 'pessimistic_write';

					return builder;
				},
				getOne: async () => {
					if (locked) {
						await acquire(String(where.id), held);
					}

					const row = cards.find((one) => matches(one, where));

					return row ? { ...row } : null;
				}
			};

			return builder;
		},
		findOne: async (_entity: unknown, options: { where?: Record<string, unknown> }) => {
			const row = cards.find((one) => matches(one, options?.where));

			return row ? { ...row } : null;
		},
		find: async (_entity: unknown, options: { where?: Record<string, unknown> }) =>
			ledger.filter((row) => matches(row, options?.where)).map((row) => ({ ...row })),
		// A conditional write is a WHERE: every member of the criteria has to hold, and the affected count
		// is the answer. A double that matched on the id alone would report every conditional write as
		// landing.
		update: async (_entity: unknown, criteria: Record<string, unknown>, partial: Partial<IGiftCardRow>) => {
			if (storage.failCardWrite) {
				throw new Error('the card write failed');
			}

			const matching = storage.alwaysContended ? [] : cards.filter((one) => matches(one, criteria));

			for (const row of matching) {
				const before = { ...row };

				Object.assign(row, partial);
				undo.push(() => {
					Object.keys(row).forEach((key) => delete (row as never)[key]);
					Object.assign(row, before);
				});
			}

			return { affected: matching.length };
		},
		create: (_entity: unknown, partial: ILedgerRow) => ({ id: `ledger-${++ledgerSequence}`, ...partial }),
		save: async (_entity: unknown, entity: ILedgerRow) => {
			if (storage.failLedgerInsert) {
				throw new Error('the ledger insert failed');
			}

			ledger.push(entity);
			undo.push(() => ledger.splice(ledger.indexOf(entity), 1));

			return entity;
		}
	});

	const manager = {
		transaction: async <T>(work: (transactional: unknown) => Promise<T>): Promise<T> => {
			const undo: Array<() => void> = [];
			const held: Array<() => void> = [];

			try {
				return await work(transactionalManager(undo, held));
			} catch (error) {
				undo.reverse().forEach((step) => step());

				throw error;
			} finally {
				held.forEach((release) => release());
			}
		}
	};

	const repository = {
		manager,
		find: async (options?: { where?: Record<string, unknown> }) =>
			cards.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown>; select?: Record<string, boolean> }) => {
			const row = cards.filter((one) => matches(one, options?.where))[0] ?? null;

			if (!row || !options?.select) {
				return row;
			}

			// A projection reaches the repository as a column map — `{ pin: true }`, not `['pin']` —
			// so the double keeps the columns the map names and drops the rest, as the projection does.
			const keys = Object.keys(options.select).filter((key) => options.select?.[key]);

			return Object.fromEntries(keys.map((key) => [key, (row as never)[key]])) as never;
		},
		findOneBy: async (where?: Record<string, unknown>) => cards.filter((row) => matches(row, where))[0] ?? null,
		create: (partial: IGiftCardRow) => ({ id: `card-${cards.length + 1}`, ...partial }),
		save: async (entity: IGiftCardRow) => {
			cards.push(entity);

			return entity;
		},
		// Scoped criteria: see the note in the campaign budget suite. The write addresses
		// `{ id, tenantId }` rather than an identifier on its own.
		update: async (criteria: string | Record<string, unknown>, partial: Partial<IGiftCardRow>) => {
			if (storage.failCardWrite) {
				throw new Error('the card write failed');
			}

			const row = cards.find((one) => matches(one, criteriaOf(criteria)));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: 1 };
		}
	};

	const ledgerRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			ledger.filter((row) => matches(row, options?.where)),
		create: (partial: ILedgerRow) => ({ id: `ledger-${++ledgerSequence}`, ...partial }),
		save: async (entity: ILedgerRow) => {
			if (storage.failLedgerInsert) {
				throw new Error('the ledger insert failed');
			}

			ledger.push(entity);

			return entity;
		}
	};

	const giftCardTransactionService = new GiftCardTransactionService(ledgerRepository as never, {} as never);

	return {
		cards,
		ledger,
		published,
		giftCardTransactionService,
		service: new GiftCardService(repository as never, {} as never, giftCardTransactionService, {
			publish: async (event: unknown) => published.push(event)
		} as never)
	};
}

describe('GiftCardService.issue — the face value and its first movement (doc 08 §13.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('issues a card with its face value and records the credit', async () => {
		const { service, ledger } = serviceUnderTest([]);

		const card = await service.issue({ code: 'GC-1000', initialAmount: '100.000000', currency: 'USD' });

		expect(card.balance).toBe('100.000000');
		expect(card.status).toBe(GiftCardStatus.ACTIVE);
		expect(ledger).toHaveLength(1);
		expect(ledger[0]).toMatchObject({
			giftCardId: card.id,
			amount: '100.000000',
			balanceAfter: '100.000000',
			type: GiftCardTransactionType.ISSUE
		});
	});

	it('refuses to issue a card with no value on it', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.issue({ code: 'GC-0', initialAmount: '0', currency: 'USD' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});

describe('GiftCardService.redeem — a card can never overpay an order (fixtures F-24, F-25, F-27)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.useFakeTimers({ now: AT });
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('applies the outstanding amount and leaves the residual on an ACTIVE card', async () => {
		// F-24: a 100.00 card against a 60.00 outstanding order redeems 60.00 and keeps 40.00.
		const { service, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);

		const { card, applied } = await service.redeem('gc-1', '100.000000', {
			orderId: ORDER,
			outstanding: '60.000000'
		});

		expect(applied).toBe('-60');
		expect(card.balance).toBe('40');
		expect(card.status).toBe(GiftCardStatus.ACTIVE);
		expect(ledger).toHaveLength(1);
		expect(ledger[0]).toMatchObject({
			amount: '-60',
			balanceAfter: '40',
			type: GiftCardTransactionType.REDEEM,
			orderId: ORDER
		});
	});

	it('closes a card whose whole balance is spent, and refuses a second redemption', async () => {
		// F-25: an exact redemption reaches REDEEMED, and the next attempt writes nothing.
		const { service, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);

		const { card, applied } = await service.redeem('gc-1', '100.000000', {
			orderId: ORDER,
			outstanding: '100.000000'
		});

		expect(applied).toBe('-100');
		expect(card.balance).toBe('0');
		expect(card.status).toBe(GiftCardStatus.REDEEMED);

		const movements = ledger.length;
		await expect(
			service.redeem('gc-1', '10.000000', { orderId: ORDER, outstanding: '10.000000' })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(ledger).toHaveLength(movements);
	});

	it('applies at most the balance when more is asked for, and never drives the card negative', async () => {
		// GC2: a redemption larger than the balance is partly applied as documented — the card pays what
		// it has and the balance lands exactly on zero, never below it.
		const { service, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);

		const { applied, card } = await service.redeem('gc-1', '250.000000', {
			orderId: ORDER,
			outstanding: '250.000000'
		});

		expect(applied).toBe('-100');
		expect(card.balance).toBe('0');
		expect(card.status).toBe(GiftCardStatus.REDEEMED);
		expect(ledger[0].amount).toBe('-100');
	});

	it('refuses a card of another currency rather than converting it', async () => {
		// F-27: no conversion is ever applied to a gift card, and a refused redemption leaves no trace.
		const { service, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-USD' })]);

		await expect(
			service.redeem('gc-1', '50.000000', { orderId: ORDER, orderCurrency: 'CAD', outstanding: '50.000000' })
		).rejects.toMatchObject({ message: expect.stringContaining('GIFT_CARD_CURRENCY_MISMATCH') });
		expect(ledger).toHaveLength(0);
	});

	it('refuses an expired card and leaves its balance alone', async () => {
		// The default expiry policy keeps the balance as an audit artefact: only new redemptions stop.
		const { service, cards } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-OLD', expiresAt: LAST_YEAR })]);

		await expect(
			service.redeem('gc-1', '10.000000', { orderId: ORDER, outstanding: '10.000000' })
		).rejects.toMatchObject({ message: expect.stringContaining('GIFT_CARD_EXPIRED') });
		expect(cards[0].balance).toBe('100.000000');
	});

	it('refuses a redemption that would apply nothing', async () => {
		const { service } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);

		await expect(service.redeem('gc-1', '10.000000', { orderId: ORDER, outstanding: '0' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});

describe('GiftCardService.refund and adjust — value returning to a card (fixtures F-26, P6.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('restores exactly what was consumed, and never more than the card paid', async () => {
		// A card that paid 60.00 can be refunded 60.00 in total however the refunds are split, so a
		// replayed refund cannot credit money the card never spent.
		const { service, cards } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);
		await service.redeem('gc-1', '100.000000', { orderId: ORDER, outstanding: '60.000000' });

		const first = await service.refund('gc-1', '20.000000', { orderId: ORDER });
		expect(first.card.balance).toBe('60');

		// Asking for more than remains refundable returns only the remainder, not the asked-for amount.
		const second = await service.refund('gc-1', '100.000000', { orderId: ORDER });
		expect(second.card.balance).toBe('100');
		expect(Number(second.card.balance)).toBeLessThanOrEqual(Number(cards[0].initialAmount));

		// Nothing is refundable a third time.
		await expect(service.refund('gc-1', '5.000000', { orderId: ORDER })).rejects.toBeInstanceOf(BadRequestException);
		expect(cards[0].balance).toBe('100');
	});

	it('restores the original balance when the whole redemption is refunded (P6.4)', async () => {
		const { service } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);
		await service.redeem('gc-1', '40.000000', { orderId: ORDER, outstanding: '40.000000' });

		const { card } = await service.refund('gc-1', '40.000000', { orderId: ORDER });

		expect(card.balance).toBe('100');
		expect(card.status).toBe(GiftCardStatus.ACTIVE);
	});

	it('keeps the ledger and the stored balance in step across a redemption, a correction and a refund', async () => {
		// The chain of movements adds up to the balance the card holds, and every balance a movement
		// records is the balance that followed it (GC1/GC4).
		const { service, cards, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);
		await service.redeem('gc-1', '25.000000', { orderId: ORDER, outstanding: '25.000000' });
		await service.adjust('gc-1', '10.000000', 'Goodwill');
		await service.refund('gc-1', '5.000000', { orderId: ORDER });

		expect(cards[0].balance).toBe('90');
		expect(ledger.map((row) => row.type)).toEqual([
			GiftCardTransactionType.REDEEM,
			GiftCardTransactionType.ADJUST,
			GiftCardTransactionType.REFUND
		]);
		expect(ledger.map((row) => row.balanceAfter)).toEqual(['75', '85', '90']);

		const moved = ledger.reduce((sum, row) => sum + Number(row.amount), 0);
		expect(Number(cards[0].initialAmount) + moved).toBe(Number(cards[0].balance));
	});

	it('refuses an adjustment that would overdraw the card, and one with no reason', async () => {
		const { service, cards } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);

		await expect(service.adjust('gc-1', '-150.000000', 'Correction')).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.adjust('gc-1', '-10.000000', '   ')).rejects.toBeInstanceOf(BadRequestException);
		expect(cards[0].balance).toBe('100.000000');
	});
});

describe('GiftCardService.expire, cancel and balanceByCode (doc 08 §13.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes off a forfeited balance as one EXPIRE movement and none when the policy blocks', async () => {
		// P6.6: expiry produces exactly one EXPIRE transaction or none, so the liability is either
		// visibly written off or visibly still there.
		const forfeiting = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-A', expiresAt: LAST_YEAR })]);
		const blocked = serviceUnderTest([giftCard({ id: 'gc-2', code: 'GC-B', expiresAt: LAST_YEAR })]);

		const forfeited = await forfeiting.service.expire('gc-1', true);
		const kept = await blocked.service.expire('gc-2', false);

		expect(forfeited.status).toBe(GiftCardStatus.EXPIRED);
		expect(forfeited.balance).toBe('0');
		expect(forfeiting.ledger).toHaveLength(1);
		expect(forfeiting.ledger[0]).toMatchObject({ type: GiftCardTransactionType.EXPIRE, amount: '-100' });

		expect(kept.status).toBe(GiftCardStatus.EXPIRED);
		expect(kept.balance).toBe('100.000000');
		expect(blocked.ledger).toHaveLength(0);
	});

	it('cancels a card without touching its ledger or its balance', async () => {
		// The liability was real even though the card can no longer be spent.
		const { service, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })]);

		const cancelled = await service.cancel('gc-1', 'Reported lost');

		expect(cancelled.status).toBe(GiftCardStatus.CANCELED);
		expect(cancelled.balance).toBe('100.000000');
		expect(ledger).toHaveLength(0);

		await expect(
			service.redeem('gc-1', '10.000000', { orderId: ORDER, outstanding: '10.000000' })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('looks a balance up by code, and requires the second factor when the card has one', async () => {
		// The code is printed on the card and is not a secret; the PIN is stored only as a digest and is
		// what a balance lookup is gated on.
		const pin = '4821';
		const { service } = serviceUnderTest([
			giftCard({ id: 'gc-1', code: 'GC-PIN', pin: createHash('sha256').update(pin).digest('hex') })
		]);

		await expect(service.balanceByCode('gc-pin', '0000')).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.balanceByCode('gc-pin')).rejects.toBeInstanceOf(BadRequestException);

		const balance = await service.balanceByCode('gc-pin', pin);

		expect(balance).toEqual({ balance: '100.000000', currency: 'USD', status: GiftCardStatus.ACTIVE });
	});
});

/**
 * The cases each defect was found by. Each asserts what the domain requires, and each passes now
 * that the source does it.
 */
describe('GiftCardService — the behaviour each defect was found by', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('keeps a balance an exact decimal when the amounts are not representable in binary', async () => {
		// A balance is money (doc 07 §1.2). `applyMovement` moves it through the money layer, so spending
		// 0.10 of a 0.30 card leaves `0.2`: a value the money layer carries and the customer can spend.
		const { service, cards } = serviceUnderTest([
			giftCard({ id: 'gc-1', code: 'GC-ODD', initialAmount: '0.300000', balance: '0.300000' })
		]);

		const { card } = await service.redeem('gc-1', '0.100000', { orderId: ORDER, outstanding: '0.100000' });

		expect(Money.of(card.balance, 'USD').toStorageString()).toBe('0.200000');
		expect(card.balance).toBe('0.2');
		expect(cards[0].balance).not.toContain('999999');
	});

	it('derives the same balance the card stores', async () => {
		// GC1 and the ledger's own docblock require the derived figure and the stored column to agree.
		// The `ISSUE` row is the record of the credit that created the card, so the derivation adds the
		// face value to the movements after it and not to the issue row as well.
		const { service, cards, giftCardTransactionService } = serviceUnderTest([]);
		const card = await service.issue({ code: 'GC-1000', initialAmount: '100.000000', currency: 'USD' });

		const derived = await giftCardTransactionService.deriveBalance(card.id, card.initialAmount);

		expect(derived).toBe(cards[0].balance);
	});
});

/**
 * Two movements of one card at the same instant (PR #10254 review: "Gift cards can spend twice").
 *
 * `applyMovement` used to read the balance, write the ledger row and then replace the balance with no
 * lock and no transaction, so two redemptions of 80 against 100 both read 100, both passed and both
 * stored 20: 160 spent from a card that held 100. The refund ceiling was read the same way, before the
 * writes. Each race is run on both storage behaviours: Postgres, where the card is locked `FOR UPDATE`
 * and the second movement waits for the first; and a storage that takes no row lock and runs the two
 * side by side, where the write conditional on the balance it was decided on is the only guard.
 */
describe('GiftCardService — concurrent movements of one card', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * GC1 and GC2 together: the stored balance is the face value plus every movement after the issue,
	 * it is never negative, and each movement's `balanceAfter` is the balance it left.
	 */
	const expectLedgerAndBalanceAgree = (card: IGiftCardRow, ledger: ILedgerRow[]) => {
		const moved = ledger.reduce((sum, row) => Money.of(sum, 'USD').add(Money.of(row.amount, 'USD')).amount, '0');

		expect(Money.of(card.initialAmount, 'USD').add(Money.of(moved, 'USD')).toStorageString()).toBe(
			Money.of(card.balance, 'USD').toStorageString()
		);
		expect(Money.of(card.balance, 'USD').isNegative()).toBe(false);

		let running = Money.of(card.initialAmount, 'USD');

		for (const row of ledger) {
			running = running.add(Money.of(row.amount, 'USD'));
			expect(Money.of(row.balanceAfter, 'USD').toStorageString()).toBe(running.toStorageString());
		}
	};

	it.each(['postgres', 'sqlite'] as const)(
		'two redemptions of 80 racing on a card of 100 never spend more than it holds (%s)',
		async (dialect) => {
			const { service, cards, ledger, published } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-RACE' })], {
				dialect
			});

			const outcomes = await Promise.allSettled([
				service.redeem('gc-1', '80.000000', { orderId: ORDER, outstanding: '80.000000' }),
				service.redeem('gc-1', '80.000000', { orderId: ORDER, outstanding: '80.000000' })
			]);

			// The second redemption is decided on what the first left: it applies the 20 the card still
			// holds, never a second 80.
			const applied = outcomes
				.filter((outcome): outcome is PromiseFulfilledResult<{ applied: string }> => outcome.status === 'fulfilled')
				.map((outcome) => outcome.value.applied)
				.sort();

			expect(applied).toEqual(['-20', '-80']);
			expect(ledger.map((row) => row.amount).sort()).toEqual(['-20', '-80']);
			expect(cards[0].balance).toBe('0');
			expect(cards[0].status).toBe(GiftCardStatus.REDEEMED);
			expectLedgerAndBalanceAgree(cards[0], ledger);
			expect(published).toHaveLength(2);
		}
	);

	it.each(['postgres', 'sqlite'] as const)(
		'two refunds racing on one card never return more than it paid (%s)',
		async (dialect) => {
			const { service, cards, ledger } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-REFUND' })], {
				dialect
			});
			await service.redeem('gc-1', '80.000000', { orderId: ORDER, outstanding: '80.000000' });

			const outcomes = await Promise.allSettled([
				service.refund('gc-1', '80.000000', { orderId: ORDER }),
				service.refund('gc-1', '80.000000', { orderId: ORDER })
			]);

			// The ceiling (what the card paid, less what was already returned) is read under the same
			// lock as the write, so the second refund finds it used up and is refused.
			expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['fulfilled', 'rejected']);
			expect(
				(outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason
			).toBeInstanceOf(BadRequestException);
			expect(ledger.filter((row) => row.type === GiftCardTransactionType.REFUND).map((row) => row.amount)).toEqual([
				'80'
			]);
			expect(cards[0].balance).toBe('100');
			expectLedgerAndBalanceAgree(cards[0], ledger);
		}
	);

	it('writes no ledger row and announces nothing when the balance write fails', async () => {
		const { service, cards, ledger, published } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })], {
			failCardWrite: true
		});

		await expect(
			service.redeem('gc-1', '30.000000', { orderId: ORDER, outstanding: '30.000000' })
		).rejects.toBeDefined();

		expect(ledger).toHaveLength(0);
		expect(cards[0].balance).toBe('100.000000');
		expect(published).toHaveLength(0);
	});

	it('leaves the balance where it was when the ledger row cannot be written', async () => {
		const { service, cards, ledger, published } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })], {
			failLedgerInsert: true
		});

		await expect(
			service.redeem('gc-1', '30.000000', { orderId: ORDER, outstanding: '30.000000' })
		).rejects.toBeDefined();

		expect(ledger).toHaveLength(0);
		expect(cards[0].balance).toBe('100.000000');
		expect(cards[0].status).toBe(GiftCardStatus.ACTIVE);
		expect(published).toHaveLength(0);
	});

	it('gives up with GIFT_CARD_CONFLICT when the card keeps moving, having written nothing', async () => {
		const { service, cards, ledger, published } = serviceUnderTest([giftCard({ id: 'gc-1', code: 'GC-1000' })], {
			dialect: 'sqlite',
			alwaysContended: true
		});

		await expect(
			service.redeem('gc-1', '30.000000', { orderId: ORDER, outstanding: '30.000000' })
		).rejects.toMatchObject({ message: expect.stringContaining('GIFT_CARD_CONFLICT') });

		expect(ledger).toHaveLength(0);
		expect(cards[0].balance).toBe('100.000000');
		expect(published).toHaveLength(0);
	});

	it('writes a forfeited balance off and expires the card in one write, decided under the lock', async () => {
		const { service, cards, ledger } = serviceUnderTest([
			giftCard({ id: 'gc-1', code: 'GC-EXP', expiresAt: LAST_YEAR, balance: '35.000000' })
		]);

		const expired = await service.expire('gc-1', true);

		expect(expired.status).toBe(GiftCardStatus.EXPIRED);
		expect(cards[0]).toMatchObject({ balance: '0', status: GiftCardStatus.EXPIRED });
		expect(ledger).toEqual([
			expect.objectContaining({ type: GiftCardTransactionType.EXPIRE, amount: '-35', balanceAfter: '0' })
		]);
	});
});
