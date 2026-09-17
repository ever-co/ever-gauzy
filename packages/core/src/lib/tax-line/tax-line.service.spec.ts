jest.mock('../core/crud/crud.service', () => {
	// The rules asserted here are the ledger's own, and the real base class reaches the entity barrel
	// and with it the whole application graph. A unit test pays for the narrowest surface the module
	// under test touches, so the base class is replaced by the one thing a subclass inherits from it:
	// a constructor.
	class CrudService {}

	return { CrudService };
});

import { ITaxLineCreateInput, TaxLineOwnerType } from '@gauzy/contracts';
import { ApiException } from '../core/errors/api-exception';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { Money } from '../money/money';
import { TaxLineService } from './tax-line.service';
import { TypeOrmTaxLineRepository } from './repository/type-orm-tax-line.repository';

/**
 * The tax ledger.
 *
 * A tax total is explainable only because it is rows: which rate produced which amount on which
 * base. The service does not compute tax — the tax package does — so what is asserted here is
 * everything the ledger *is* answerable for: that it stores the exact decimals it was given and
 * neither re-derives nor re-rounds them, that the rows of one owner sum to that owner's tax exactly,
 * that a rate which produced nothing is still visible, that the exempt line and the zero-rated line
 * are told apart, and that one owner never carries two currencies.
 *
 * The figures are the specification's own worked examples (a line taxed at 5 % then 9.975 %
 * compound, a line of three units at 24.99 with 20 % tax, a price inclusive of 20 % whose gross is
 * 0.15), so the cases state the mandated answer rather than whatever the code currently returns.
 * Where a second rule could plausibly have been implemented the case computes that alternative too
 * and asserts the ledger does *not* carry it.
 *
 * The ledger is exercised against an in-memory table that behaves like the table it stands in for.
 */

type Row = Record<string, any>;

/** An in-memory stand-in for one table: it filters and orders the way the service asks it to. */
class Table {
	readonly rows: Row[] = [];
	private sequence = 0;

	create(input: Row): Row {
		this.sequence += 1;

		return {
			id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
			createdAt: new Date(Date.UTC(2026, 2, 1, 10, 0, this.sequence)),
			...input
		};
	}

	async save(row: Row): Promise<Row> {
		if (!this.rows.includes(row)) {
			this.rows.push(row);
		}

		return row;
	}

	async find(options: { where?: Row; order?: Row } = {}): Promise<Row[]> {
		return this.rows.filter((row) => this.matches(row, options.where)).sort(byOrder(options.order));
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.rows.find((row) => this.matches(row, options.where)) ?? null;
	}

	private matches(row: Row, where: Row = {}): boolean {
		return Object.entries(where).every(([column, condition]) => (row[column] ?? null) === (condition ?? null));
	}
}

/** The comparator `find` sorts with, so `createdAt ASC, id ASC` means what it says. */
function byOrder(order: Row = {}): (left: Row, right: Row) => number {
	const columns = Object.keys(order);

	return (left, right) => {
		for (const column of columns) {
			if (left[column] === right[column]) {
				continue;
			}

			const direction = order[column] === 'DESC' ? -1 : 1;

			return (left[column] > right[column] ? 1 : -1) * direction;
		}

		return 0;
	};
}

const CART_LINE = TaxLineOwnerType.CART_LINE;
const LINE = '6b1e0f2a-0000-4000-8000-000000000001';

/** An input that passes every rule, so a case can vary exactly one thing. */
const line = (overrides: Partial<ITaxLineCreateInput> = {}): ITaxLineCreateInput => ({
	ownerType: CART_LINE,
	ownerId: LINE,
	code: 'GST',
	name: 'GST 5%',
	rate: '0.05',
	baseAmount: '10.00',
	amount: '0.50',
	currency: 'USD',
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

/** The service under test and the table it writes to. */
function ledger() {
	const taxLines = new Table();
	const service = new TaxLineService(
		taxLines as unknown as TypeOrmTaxLineRepository,
		{} as never
	);

	return { service, taxLines };
}

/** The exact amount a stored value represents. */
const stored = (amount: string): Money => Money.fromStorage(amount, 'USD');

describe('recording a tax line', () => {
	it('stores a zero-rated and an exempt line, because the invoice has to show why nothing was charged', async () => {
		const { service, taxLines } = ledger();

		await service.append(
			line({ code: 'ZERO', name: 'Zero rated', rate: '0', baseAmount: '20.00', amount: '0.000000' })
		);
		await service.append(
			line({
				code: 'EXEMPT',
				name: 'Tax exempt',
				rate: '0',
				baseAmount: '20.00',
				amount: '0',
				metadata: { exemptionSource: 'CUSTOMER_PROFILE' }
			})
		);

		const summary = await service.groupByRate(CART_LINE, LINE);

		expect(summary.rates).toHaveLength(2);
		expect(summary.rates.map((rate) => rate.code)).toEqual(['ZERO', 'EXEMPT']);
		expect(summary.rates.map((rate) => rate.amount)).toEqual(['0.000000', '0.000000']);
		expect(summary.total).toBe('0.000000');
		expect(await service.sumForOwner(CART_LINE, LINE, 'USD')).toBe('0.000000');

		// Control: a ledger that dropped an empty line — the obvious "skip what contributes nothing"
		// optimisation — would report no breakdown at all for an exempt owner.
		expect(taxLines.rows.filter((row) => Number(row.amount) > 0)).toHaveLength(0);
	});

	it('normalises the rate, the bases and the currency it was handed', async () => {
		const { service } = ledger();

		const row = await service.append(
			line({ rate: '0.050000', baseAmount: '10.000000', amount: '0.500000', currency: 'usd' })
		);

		// A rate is stored as the fraction it is, and two spellings of it are one rate.
		expect(row.rate).toBe('0.05');
		expect(row.baseAmount).toBe('10');
		expect(row.amount).toBe('0.5');
		expect(row.currency).toBe('USD');
		expect(row.isCompound).toBe(false);
		expect(row.isInclusive).toBe(false);
	});

	it('refuses a negative rate, which would reduce a document’s tax rather than exempt it', async () => {
		const { service, taxLines } = ledger();

		expect(await refusalOf(() => service.append(line({ rate: '-0.05' })))).toMatch(
			/^TAX_LINE_RATE_INVALID/
		);
		expect(taxLines.rows).toHaveLength(0);
	});

	it('requires the rate name, an exact decimal and a currency', async () => {
		const { service } = ledger();

		expect(await refusalOf(() => service.append(line({ name: '' })))).toMatch(/^TAX_LINE_NAME_REQUIRED/);
		expect(await refusalOf(() => service.append(line({ ownerId: '' })))).toMatch(/^TAX_LINE_OWNER_REQUIRED/);
		expect(await refusalOf(() => service.append(line({ amount: '1e-7' })))).toMatch(
			/^TAX_LINE_NOT_DECIMAL_STRING/
		);
		expect(await refusalOf(() => service.append(line({ rate: 'five percent' })))).toMatch(
			/^TAX_LINE_NOT_DECIMAL_STRING/
		);
		expect(await refusalOf(() => service.append(line({ currency: 'US' })))).toMatch(
			/^TAX_LINE_CURRENCY_REQUIRED/
		);

		// A base is optional: an exemption line that was never applied to anything carries zero.
		const withoutBase = await service.append(line({ baseAmount: undefined, amount: '0' }));
		expect(withoutBase.baseAmount).toBe('0');
	});
});

describe('reading a tax ledger', () => {
	it('keeps both rates of one line, in the order they were applied', async () => {
		const { service } = ledger();

		// A line of 10.00 net, taxed at 5 % and then at 9.975 % compounding on the taxed amount: the
		// second base includes the first amount, already rounded.
		await service.append(line({ code: 'GST', name: 'GST 5%', rate: '0.05', baseAmount: '10.00', amount: '0.50' }));
		await service.append(
			line({
				code: 'QST',
				name: 'QST 9.975%',
				rate: '0.09975',
				baseAmount: '10.50',
				amount: '1.05',
				isCompound: true
			})
		);

		const summary = await service.groupByRate(CART_LINE, LINE);

		expect(summary.rates.map((rate) => rate.code)).toEqual(['GST', 'QST']);
		expect(summary.rates[1].isCompound).toBe(true);
		// The compounding base is the net plus the preceding line's already-rounded amount, exactly.
		expect(
			stored(summary.rates[0].baseAmount).add(stored(summary.rates[0].amount)).toStorageString()
		).toBe(summary.rates[1].baseAmount);
		expect(summary.total).toBe('1.550000');
		expect(summary.baseTotal).toBe('20.500000');
	});

	it('sums the lines of one owner exactly, and the two read paths agree on the total', async () => {
		const { service } = ledger();

		await service.append(line({ code: 'GST', amount: '1.55', baseAmount: '10.00' }));
		await service.append(line({ code: 'GST', amount: '3.30', baseAmount: '20.00' }));
		await service.append(line({ code: 'ZERO', rate: '0', amount: '0', baseAmount: '5.00' }));

		const summary = await service.groupByRate(CART_LINE, LINE);

		expect(await service.sumForOwner(CART_LINE, LINE, 'USD')).toBe('4.850000');
		expect(summary.total).toBe(await service.sumForOwner(CART_LINE, LINE, 'USD'));
		expect(summary.baseTotal).toBe('35.000000');
		expect(summary.rates.map((rate) => rate.lineCount)).toEqual([2, 1]);
		expect(summary.rates[0].amount).toBe('4.850000');
	});

	it('groups the lines that share a code and a rate, and separates the ones that share only one', async () => {
		const { service } = ledger();

		// Two rows of one rate collapse into one entry, however the rate was spelled when written.
		await service.append(line({ code: 'GST', rate: '0.05', baseAmount: '10.00', amount: '0.50' }));
		await service.append(line({ code: 'GST', rate: '0.050000', baseAmount: '20.00', amount: '1.00' }));
		// The same rate under another jurisdiction is another entry…
		await service.append(line({ code: 'CA-GST', rate: '0.05', baseAmount: '10.00', amount: '0.50' }));
		// …and so is another rate under the same code, which is what a rate change mid-period is.
		await service.append(line({ code: 'CA-GST', rate: '0.075', baseAmount: '40.00', amount: '3.00' }));

		const summary = await service.groupByRate(CART_LINE, LINE);

		expect(summary.rates.map((rate) => `${rate.code}@${rate.rate}`)).toEqual([
			'GST@0.05',
			'CA-GST@0.05',
			'CA-GST@0.075'
		]);
		expect(summary.rates[0].lineCount).toBe(2);
		expect(summary.rates[0].baseAmount).toBe('30.000000');
		expect(summary.rates[0].amount).toBe('1.500000');
		expect(summary.total).toBe('5.000000');
	});

	it('reads the rows of one owner oldest first, so a compound line follows what it compounds on', async () => {
		const { service } = ledger();

		await service.append(
			line({
				code: 'QST',
				rate: '0.09975',
				baseAmount: '10.50',
				amount: '1.05',
				isCompound: true,
				createdAt: new Date('2026-03-01T12:00:00Z')
			})
		);
		await service.append(
			line({ code: 'GST', rate: '0.05', baseAmount: '10.00', amount: '0.50', createdAt: new Date('2026-03-01T10:00:00Z') })
		);

		expect((await service.findByOwner(CART_LINE, LINE)).map((row) => row.code)).toEqual(['GST', 'QST']);
	});

	it('tells a zero-rated line apart from an exempt one, though neither produced tax', async () => {
		const { service } = ledger();

		await service.append(line({ code: 'ZERO', name: 'Zero rated', rate: '0', amount: '0', taxRateId: undefined }));
		await service.append(line({ code: 'EXEMPT', name: 'Tax exempt', rate: '0', amount: '0', taxRateId: undefined }));

		const summary = await service.groupByRate(CART_LINE, LINE);

		// Control: a summary keyed on the rate alone would collapse the two into one entry and lose
		// the reason the customer was not charged.
		expect(summary.rates).toHaveLength(2);
		expect(summary.rates.map((rate) => rate.name)).toEqual(['Zero rated', 'Tax exempt']);
	});

	it('refuses to total a ledger whose lines disagree on currency', async () => {
		const { service } = ledger();

		await service.append(line({ amount: '0.50' }));
		await service.append(line({ amount: '0.50', currency: 'EUR' }));

		expect(await refusalOf(() => service.sumForOwner(CART_LINE, LINE, 'USD'))).toMatch(/^CURRENCY_MISMATCH/);
		expect(await refusalOf(() => service.groupByRate(CART_LINE, LINE))).toMatch(/^CURRENCY_MISMATCH/);
	});

	it('reports zero for an owner that carries no tax lines', async () => {
		const { service } = ledger();

		expect(await service.sumForOwner(CART_LINE, LINE, 'usd')).toBe('0.000000');
		expect(await service.sumForOwner(CART_LINE, LINE)).toBe('0.000000');
		expect(await service.groupByRate(CART_LINE, LINE)).toEqual({
			ownerType: CART_LINE,
			ownerId: LINE,
			currency: '',
			total: '0.000000',
			baseTotal: '0.000000',
			rates: []
		});
	});

	it('answers from the snapshot it stored, so a reader never needs the rate row', async () => {
		const { service } = ledger();

		// The rate row may live in another package, or not exist at all: the ledger carries the
		// jurisdiction, the name and the rate as they were when the tax was computed.
		await service.append(
			line({
				code: 'US-CA-SALES',
				name: 'California sales tax',
				rate: '0.0725',
				baseAmount: '100.00',
				amount: '7.25',
				taxRateId: '0f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48',
				providerKey: 'external-engine'
			})
		);
		await service.append(line({ code: 'LEGACY', name: 'Legacy rate', rate: '0.05', amount: '0.50', taxRateId: null }));

		const summary = await service.groupByRate(CART_LINE, LINE);

		expect(summary.rates.map((rate) => rate.code)).toEqual(['US-CA-SALES', 'LEGACY']);
		expect(summary.rates[0]).toMatchObject({
			name: 'California sales tax',
			rate: '0.0725',
			amount: '7.250000'
		});
		expect(summary.total).toBe('7.750000');
	});
});

describe('the rounding boundary a tax ledger records', () => {
	it('records one rounding per line, not one per unit', async () => {
		const { service } = ledger();

		// Three units at 24.99 with 20 % tax. The mandated boundary is the line: 74.97 × 0.20 is
		// 14.994, which rounds to 14.99.
		const base = Money.of('24.99', 'USD').multiply(3).round();
		const tax = base.multiply('0.20').round();

		expect(base.amount).toBe('74.97');
		expect(tax.amount).toBe('14.99');

		await service.append(line({ code: 'VAT', rate: '0.20', baseAmount: base.amount, amount: tax.amount }));

		expect(await service.sumForOwner(CART_LINE, LINE, 'USD')).toBe('14.990000');

		// Control: rounding each unit first gives 3 × 5.00, a cent more than the line was charged.
		const perUnit = Money.of('24.99', 'USD').multiply('0.20').round().multiply(3);
		expect(perUnit.amount).toBe('15');
	});

	it('records one rounding per line and rate, not one per rate across the order', async () => {
		const { service } = ledger();
		const lines = ['a', 'b', 'c'].map((suffix) => `6b1e0f2a-0000-4000-8000-00000000000${suffix}`);

		// Three lines of 10.00 net, each taxed at 5 % and then at 9.975 % compounding.
		for (const ownerId of lines) {
			await service.append(line({ ownerId, code: 'GST', rate: '0.05', baseAmount: '10.00', amount: '0.50' }));
			await service.append(
				line({
					ownerId,
					code: 'QST',
					rate: '0.09975',
					baseAmount: '10.50',
					amount: '1.05',
					isCompound: true
				})
			);
		}

		let ledgerTotal = Money.zero('USD');
		for (const ownerId of lines) {
			ledgerTotal = ledgerTotal.add(Money.fromStorage(await service.sumForOwner(CART_LINE, ownerId, 'USD'), 'USD'));
		}

		expect(ledgerTotal.toStorageString()).toBe('4.650000');

		// Control: assessing the order once per rate gives 4.64 — the same inputs, a different
		// boundary, and a cent of tax that would otherwise go unexplained.
		const perRate = Money.of('30.00', 'USD')
			.multiply('0.05')
			.round()
			.add(Money.of('31.50', 'USD').multiply('0.09975').round());
		expect(perRate.toStorageString()).toBe('4.640000');
	});

	it('keeps the residual split of an inclusive price instead of re-deriving it from the rate', async () => {
		const { service } = ledger();

		// A price of 0.15 inclusive of 20 %: the net is round(0.15 / 1.20) = 0.13 and the tax is the
		// residual 0.02, so that net and tax always reconstruct the gross the customer pays.
		await service.append(
			line({
				code: 'VAT',
				rate: '0.20',
				baseAmount: '0.13',
				amount: '0.02',
				isInclusive: true
			})
		);

		const summary = await service.groupByRate(CART_LINE, LINE);

		expect(summary.rates[0].isInclusive).toBe(true);
		expect(await service.sumForOwner(CART_LINE, LINE, 'USD')).toBe('0.020000');
		expect(stored(summary.rates[0].baseAmount).add(stored(summary.rates[0].amount)).toStorageString()).toBe(
			'0.150000'
		);

		// Control: applying the rate to the gross would have given 0.03 of tax and 0.12 of net — the
		// same gross, a cent of tax that was never charged.
		expect(Money.of('0.15', 'USD').multiply('0.20').divide('1.20').round().amount).toBe('0.03');
	});

	it('refuses one owner that mixes an inclusive and an exclusive line of the same rate', async () => {
		// The one combination that double-counts: a totals writer told `isInclusive` by the first row
		// of a group cannot tell that half the group is already inside the price (WI-13, invariant 2).
		// The service refuses the second line rather than grouping two bases under one rate.
		const { service, taxLines } = ledger();

		await service.append(line({ code: 'VAT', rate: '0.20', baseAmount: '0.13', amount: '0.02', isInclusive: true }));

		// The refusal is the platform's own exception carrying the document's code, which is what a
		// client branches on — the same string on the REST envelope and in a GraphQL error's
		// `extensions.code`. The message is human-facing and is deliberately not asserted.
		const refusal = await service
			.append(line({ code: 'VAT', rate: '0.20', baseAmount: '10.00', amount: '2.00', isInclusive: false }))
			.then(() => undefined)
			.catch((error) => error as ApiException);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.TAX_INCLUSIVE_MISMATCH);
		expect(refusal.getStatus()).toBe(409);

		// The refused line leaves nothing behind, so the group is still described by the one basis it
		// was written with rather than by whichever row happened to be first.
		expect(taxLines.rows).toHaveLength(1);
		expect((await service.groupByRate(CART_LINE, LINE)).rates[0].isInclusive).toBe(true);
	});
});
