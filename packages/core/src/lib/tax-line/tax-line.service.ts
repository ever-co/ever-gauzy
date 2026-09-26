import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import {
	CurrencyCode,
	DecimalString,
	ITaxLineCreateInput,
	ITaxSummary,
	ITaxSummaryLine,
	ID,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiException } from '../core/errors/api-exception';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { Money } from '../money/money';
import { compareDecimalStrings, formatDecimalUnits, normalizeDecimalString } from '../money/decimal';
import { TaxLine } from './tax-line.entity';
import { TypeOrmTaxLineRepository } from './repository/type-orm-tax-line.repository';
import { MikroOrmTaxLineRepository } from './repository/mikro-orm-tax-line.repository';

/**
 * Writes and reads the platform's tax ledger.
 *
 * The ledger is what makes a tax total explainable: the sum of the amounts of one owner's lines is
 * that owner's tax, and grouping the lines by rate answers "how much of this was the state tax". Both
 * are computed from the exact decimals the rows hold, so a reconciliation against a totals column
 * agrees by construction rather than approximately.
 */
@Injectable()
export class TaxLineService extends CrudService<TaxLine> {
	constructor(
		readonly typeOrmTaxLineRepository: TypeOrmTaxLineRepository,
		readonly mikroOrmTaxLineRepository: MikroOrmTaxLineRepository
	) {
		super(typeOrmTaxLineRepository, mikroOrmTaxLineRepository);
	}

	/**
	 * Appends one tax line to the ledger.
	 *
	 * Recomputing an owner's tax rewrites its lines: the caller removes the owner's rows and appends the
	 * new ones inside the same transaction, because a half-rewritten breakdown is a breakdown that
	 * reconciles against nothing.
	 *
	 * @param input The line to write.
	 * @returns The stored row.
	 * @throws BadRequestException when a required field is missing or an amount is not an exact decimal.
	 * @throws ApiException `TAX_INCLUSIVE_MISMATCH` (409) when the line would give one owner two bases
	 * under one rate.
	 */
	async append(input: ITaxLineCreateInput): Promise<TaxLine> {
		if (!input?.ownerId) {
			throw new BadRequestException('TAX_LINE_OWNER_REQUIRED: a tax line must name the row it belongs to.');
		}

		if (!input.name) {
			throw new BadRequestException(
				'TAX_LINE_NAME_REQUIRED: a tax line must carry the rate name it was computed with.'
			);
		}

		const rate = this.readDecimal(input.rate, 'rate');
		const baseAmount = this.readDecimal(input.baseAmount ?? '0', 'taxable base');
		const amount = this.readDecimal(input.amount, 'tax amount');
		const currency = this.readCurrency(input.currency);
		const isInclusive = input.isInclusive ?? false;

		// The rate is a fraction of the base. A negative one is not a rate — an exemption is a zero-rate
		// line with a reason in its metadata — and letting it through would silently reduce a document's
		// tax.
		if (compareDecimalStrings(rate, '0') < 0) {
			throw new BadRequestException('TAX_LINE_RATE_INVALID: a tax rate cannot be negative.');
		}

		await this.assertOneBasisPerRate(input.ownerType, input.ownerId, input.code, rate, isInclusive);

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const created = this.typeOrmTaxLineRepository.create({
			...input,
			rate,
			baseAmount,
			amount,
			currency,
			isCompound: input.isCompound ?? false,
			isInclusive,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		} as Partial<TaxLine>);

		return this.typeOrmTaxLineRepository.save(created);
	}

	/**
	 * Refuses a line that would give one owner two bases under one rate.
	 *
	 * `groupByRate` collapses the lines of one `(code, rate)` into a single entry and describes that
	 * entry from the first row it read. A group holding both an inclusive and an exclusive line would
	 * therefore be reported as whichever of the two happened to be written first, and the two cannot
	 * be totalled together either: an inclusive line's amount is already inside the price and an
	 * exclusive line's is not, so a totals writer told "inclusive" adds the exclusive half a second
	 * time. The combination is refused here because a write is the only place it can be refused — the
	 * rows of one rate are written one at a time and read as a group.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @param code The rate code of the line being written.
	 * @param rate The rate of the line being written, in canonical form.
	 * @param isInclusive Whether the line being written is already inside the price.
	 * @throws ApiException with `TAX_INCLUSIVE_MISMATCH`, the code `docs/06-api-specification.md`
	 * documents for an inclusive setting that disagrees with the line, when a stored line of the same
	 * owner shares the code and the rate and states the other basis. No row is written.
	 */
	private async assertOneBasisPerRate(
		ownerType: TaxLineOwnerType,
		ownerId: ID,
		code: string | undefined,
		rate: DecimalString,
		isInclusive: boolean
	): Promise<void> {
		const siblings = await this.findByOwner(ownerType, ownerId);

		for (const row of siblings) {
			// The code and the rate together identify the group, exactly as they do when the group is
			// read back, so a mix under one rate of another jurisdiction is a different group and is
			// left alone.
			if ((row.code ?? '') !== (code ?? '') || !this.isSameRate(row.rate, rate)) {
				continue;
			}

			if ((row.isInclusive === true) === isInclusive) {
				continue;
			}

			throw new ApiException(
				HttpStatus.CONFLICT,
				ApiErrorCode.TAX_INCLUSIVE_MISMATCH,
				`The tax lines of one owner cannot mix an inclusive and an exclusive line of one rate; ` +
					`"${code ?? ''}" at ${rate} is already recorded as ` +
					`${row.isInclusive === true ? 'inclusive' : 'exclusive'}.`,
				{
					code: code ?? '',
					rate,
					recordedIsInclusive: row.isInclusive === true,
					refusedIsInclusive: isInclusive
				}
			);
		}
	}

	/**
	 * @param left One rate.
	 * @param right The other rate.
	 * @returns True when the two spellings are one rate, compared as the exact decimals they are so
	 * that `0.05` and `0.050000` are the same rate and not two.
	 */
	private isSameRate(left: DecimalString, right: DecimalString): boolean {
		try {
			return compareDecimalStrings(left, right) === 0;
		} catch {
			// A stored value that is not an exact decimal cannot be called equal to anything; comparing
			// it as it stands at least keeps the refusal from firing on a value it cannot interpret.
			return String(left) === String(right);
		}
	}

	/**
	 * Reads the tax lines of one owner.
	 *
	 * Rows are read oldest first, which is the order a compound rate was accumulated in: a compound line
	 * is written after the lines it compounds on, and insertion order is what expresses that.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @returns The rows, oldest first.
	 */
	async findByOwner(ownerType: TaxLineOwnerType, ownerId: ID): Promise<TaxLine[]> {
		return this.typeOrmTaxLineRepository.find({
			where: { ownerType, ownerId, ...this.scopeWhere() } as any,
			order: { createdAt: 'ASC', id: 'ASC' } as any
		});
	}

	/**
	 * Sums the tax of one owner.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @param currency The currency the owner is expressed in; used for an owner with no lines, whose tax
	 * total is zero.
	 * @returns The exact tax total at the storage scale.
	 * @throws BadRequestException when the lines do not all carry one currency.
	 */
	async sumForOwner(ownerType: TaxLineOwnerType, ownerId: ID, currency?: CurrencyCode): Promise<DecimalString> {
		const rows = await this.findByOwner(ownerType, ownerId);

		if (rows.length === 0) {
			// An owner with no tax lines has a zero tax total, expressed in the currency the caller states;
			// without one there is nothing to express it in but the storage scale itself.
			return currency && currency.trim().length === 3
				? Money.zero(currency.trim().toUpperCase()).toStorageString()
				: formatDecimalUnits(0n, Money.STORAGE_SCALE);
		}

		const ledgerCurrency = rows[0].currency;

		return Money.sum(this.readAmounts(rows, ledgerCurrency), ledgerCurrency).toStorageString();
	}

	/**
	 * Groups the tax lines of one owner by rate.
	 *
	 * This is the shape a tax summary is presented in and the shape an accountant reconciles: one entry
	 * per rate, with the base it was applied to and the amount it produced. Lines that share a rate code
	 * and a rate value collapse into one entry, which is what a per-line computation of the same rate
	 * amounts to.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @returns The summary: the totals, and one entry per rate in the order the rates were applied.
	 * @throws BadRequestException when the lines do not all carry one currency.
	 */
	async groupByRate(ownerType: TaxLineOwnerType, ownerId: ID): Promise<ITaxSummary> {
		const rows = await this.findByOwner(ownerType, ownerId);

		if (rows.length === 0) {
			return {
				ownerType,
				ownerId,
				currency: '',
				total: formatDecimalUnits(0n, Money.STORAGE_SCALE),
				baseTotal: formatDecimalUnits(0n, Money.STORAGE_SCALE),
				rates: []
			};
		}

		const currency = rows[0].currency;
		const grouped = new Map<string, { line: TaxLine; amounts: Money[]; bases: Money[] }>();

		for (const row of rows) {
			if (row.currency !== currency) {
				throw new BadRequestException(
					`CURRENCY_MISMATCH: the tax lines of one owner must share one currency; ` +
						`found ${currency} and ${row.currency}.`
				);
			}

			// Rate and code together identify the group: two jurisdictions can share a rate value, and a
			// synthetic line (`EXEMPT`, `AGGREGATE`) carries no rate row but still has to stay separate.
			const key = `${row.code ?? ''}|${row.rate}`;
			const entry = grouped.get(key) ?? { line: row, amounts: [], bases: [] };

			entry.amounts.push(Money.fromStorage(row.amount, currency));
			entry.bases.push(Money.fromStorage(row.baseAmount, currency));
			grouped.set(key, entry);
		}

		const rates: ITaxSummaryLine[] = [];
		let total = Money.zero(currency);
		let baseTotal = Money.zero(currency);

		for (const { line, amounts, bases } of grouped.values()) {
			const amount = Money.sum(amounts, currency);
			const baseAmount = Money.sum(bases, currency);

			total = total.add(amount);
			baseTotal = baseTotal.add(baseAmount);
			rates.push({
				code: line.code,
				name: line.name,
				rate: line.rate,
				baseAmount: baseAmount.toStorageString(),
				amount: amount.toStorageString(),
				isCompound: line.isCompound === true,
				isInclusive: line.isInclusive === true,
				currency,
				lineCount: amounts.length
			});
		}

		return {
			ownerType,
			ownerId,
			currency,
			total: total.toStorageString(),
			baseTotal: baseTotal.toStorageString(),
			rates
		};
	}

	/**
	 * @param rows The rows to read.
	 * @param currency The currency they must share.
	 * @returns The amounts as monetary values.
	 * @throws BadRequestException when a row carries another currency.
	 */
	private readAmounts(rows: readonly TaxLine[], currency: CurrencyCode): Money[] {
		return rows.map((row) => {
			if (row.currency !== currency) {
				throw new BadRequestException(
					`CURRENCY_MISMATCH: the tax lines of one owner must share one currency; ` +
						`found ${currency} and ${row.currency}.`
				);
			}

			return Money.fromStorage(row.amount, currency);
		});
	}

	/**
	 * @param value The value to read.
	 * @param what What the value represents, used in the message.
	 * @returns The value in canonical form.
	 * @throws BadRequestException when the value is not an exact decimal.
	 */
	private readDecimal(value: DecimalString, what: string): DecimalString {
		try {
			return normalizeDecimalString(value);
		} catch {
			throw new BadRequestException(
				`TAX_LINE_NOT_DECIMAL_STRING: the ${what} must be an exact decimal, received ${String(value)}.`
			);
		}
	}

	/**
	 * @param currency The currency code to check.
	 * @returns The code, upper-cased.
	 * @throws BadRequestException when it is missing.
	 */
	private readCurrency(currency: CurrencyCode): CurrencyCode {
		if (typeof currency !== 'string' || currency.trim().length !== 3) {
			throw new BadRequestException('TAX_LINE_CURRENCY_REQUIRED: a tax line must state its currency.');
		}

		return currency.trim().toUpperCase();
	}

	/**
	 * @returns The tenant and organization a read or write is scoped to, omitting what the request does
	 * not carry so that an unscoped caller is not silently restricted to rows belonging to nobody.
	 */
	private scopeWhere(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return {
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};
	}
}
