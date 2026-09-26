import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID, JsonData } from '@gauzy/contracts';
import { EntityManager } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiException } from '../core/errors/api-exception';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { Money } from '../money/money';
import { addDecimalStrings, compareDecimalStrings, normalizeDecimalString } from '../money/decimal';
import { PaymentTerm } from './payment-term.entity';
import { PaymentTermLine } from './payment-term-line.entity';
import { PaymentDueBasis, PaymentTermLineType } from './payment-term.enums';
import { PaymentTermLineService } from './payment-term-line.service';
import { TypeOrmPaymentTermRepository } from './repository/type-orm-payment-term.repository';
import { MikroOrmPaymentTermRepository } from './repository/mikro-orm-payment-term.repository';

/** One instalment of a derived schedule. */
export interface IPaymentTermInstalment {
	/** The `sequence` of the first line that landed on this date. */
	sequence: number;
	/** Every line merged into this instalment, in sequence order. */
	sequences: number[];
	/** The due date, as `YYYY-MM-DD`. */
	dueDate: string;
	/** The amount due, an exact decimal. */
	amount: DecimalString;
	/** The currency the amount is expressed in. */
	currency: CurrencyCode;
	/** The type of the first line that landed on this date. */
	valueType: PaymentTermLineType;
	/** The instalment's share of the total, when every line merged into it states one. */
	percentage?: DecimalString;
	/** The basis the due date was counted from. */
	dueBasis: PaymentDueBasis;
	/** The offset added after the basis. */
	days: number;
	/** The day of the following month, when the basis names one. */
	dayOfMonth?: number;
}

/** The schedule a term produces for one document. */
export interface IPaymentTermSchedule {
	paymentTermId: ID;
	code: string;
	name: string;
	total: DecimalString;
	currency: CurrencyCode;
	currencyDecimals: number;
	/** The document's own basis date, as `YYYY-MM-DD`. */
	basisDate: string;
	instalments: IPaymentTermInstalment[];
	/** The sum of the instalments, which equals the total exactly. */
	allocatedTotal: DecimalString;
	/** The last instalment's date: the date a document settled on this term falls due. */
	dueDate: string;
}

/** What an operator supplies to declare a term, its instalments included. */
export interface IPaymentTermInput {
	name: string;
	code: string;
	description?: string;
	isDefault?: boolean;
	metadata?: JsonData;
	lines?: IPaymentTermLineInput[];
}

/** One instalment as an operator supplies it. */
export interface IPaymentTermLineInput {
	sequence?: number;
	valueType?: PaymentTermLineType;
	valueAmount: DecimalString;
	currency?: CurrencyCode;
	dueBasis?: PaymentDueBasis;
	days?: number;
	dayOfMonth?: number;
	metadata?: JsonData;
}

/**
 * Reads and writes settlement terms, and derives the schedule one produces for a document.
 *
 * **The schedule is derived, never stored.** A term names an agreement; the money a document actually
 * owes under it depends on that document's own total and basis date, so it is computed when it is
 * asked for and never written down. Storing it would turn a projection into a ledger and create a
 * second answer to "how much is due" beside the document's own `amountDue` — which is also why
 * changing a term cannot rewrite a document already settled against it.
 *
 * **The derivation is exact.** Each fixed instalment takes its own amount, the remainder is allocated
 * across the percentage lines by the platform's allocator — the one that already guarantees the parts
 * sum back to the whole — and the schedule therefore sums to the document total exactly rather than
 * approximately. Instalments that land on the same date are presented as one, because a document with
 * two amounts due the same day owes one amount that day.
 */
@Injectable()
export class PaymentTermService extends TenantAwareCrudService<PaymentTerm> {
	constructor(
		readonly typeOrmPaymentTermRepository: TypeOrmPaymentTermRepository,
		readonly mikroOrmPaymentTermRepository: MikroOrmPaymentTermRepository,
		private readonly paymentTermLineService: PaymentTermLineService
	) {
		super(typeOrmPaymentTermRepository, mikroOrmPaymentTermRepository);
	}

	/**
	 * Reads a term of the caller's organization, with its instalments.
	 *
	 * @param id The term id.
	 * @returns The term and its lines, in sequence order.
	 * @throws NotFoundException when this organization has no such term.
	 */
	async getTerm(id: ID): Promise<PaymentTerm> {
		const term = await this.findOneByWhereOptions({
			id,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);

		if (!term) {
			throw new NotFoundException('PAYMENT_TERM_NOT_FOUND: the settlement term does not exist.');
		}

		term.lines = await this.paymentTermLineService.listByTerm(id);

		return term;
	}

	/**
	 * Reads a term by its code.
	 *
	 * @param code The term code.
	 * @returns The term, or null when this organization declares none with that code.
	 */
	async getTermByCode(code: string): Promise<PaymentTerm | null> {
		return this.findOneByWhereOptions({
			code,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);
	}

	/**
	 * The organization's default term: the one a document with no other answer is settled against.
	 *
	 * @returns The default term, or null when the organization declares none.
	 */
	async getDefaultTerm(): Promise<PaymentTerm | null> {
		return this.findOneByWhereOptions({
			isDefault: true,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);
	}

	/**
	 * Declares a term and its instalments in one transaction.
	 *
	 * @param input The term and the instalments that make up its schedule.
	 * @returns The stored term, lines included.
	 * @throws ApiException `PAYMENT_TERM_LINES_INVALID` (400) when the lines are not addressable.
	 * @throws ApiException `PAYMENT_TERM_PERCENT_SUM` (400) when the percentages do not total 100 and no
	 * fixed line takes part of the total.
	 */
	async createTerm(input: IPaymentTermInput): Promise<PaymentTerm> {
		const lines = this.normalizeLines(input.lines);
		this.assertLinesAddressable(lines);
		this.assertPercentages(lines);

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const termId = await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			const term = await manager.save(
				manager.create(PaymentTerm, {
					name: input.name,
					code: input.code,
					description: input.description,
					isDefault: input.isDefault ?? false,
					metadata: input.metadata,
					tenantId,
					organizationId
				} as Partial<PaymentTerm>)
			);

			// One transaction: a term whose header landed without its instalments would settle nothing,
			// and the two are one decision.
			await this.paymentTermLineService.replaceLines(term.id, lines, manager);

			return term.id;
		});

		return this.getTerm(termId);
	}

	/**
	 * Changes a term's header fields.
	 *
	 * The instalments are changed by their own operation, because changing a schedule is a decision an
	 * accountant makes deliberately rather than a field edit that happens to carry an array.
	 *
	 * @param id The term id.
	 * @param input The fields to change.
	 * @returns The term as it now stands.
	 * @throws NotFoundException when the term does not exist for this organization.
	 */
	async updateTerm(id: ID, input: Partial<IPaymentTermInput>): Promise<PaymentTerm> {
		await this.getTerm(id);

		const values: Partial<PaymentTerm> = {};

		if (input.name !== undefined) values.name = input.name;
		if (input.code !== undefined) values.code = input.code;
		if (input.description !== undefined) values.description = input.description;
		if (input.isDefault !== undefined) values.isDefault = input.isDefault;
		if (input.metadata !== undefined) values.metadata = input.metadata;

		if (Object.keys(values).length > 0) {
			await this.update(id, values as any);
		}

		return this.getTerm(id);
	}

	/**
	 * Replaces a term's instalments.
	 *
	 * @param id The term id.
	 * @param lines The instalments the term is to carry.
	 * @returns The term as it now stands.
	 * @throws ApiException `PAYMENT_TERM_LINES_INVALID` (400) when the lines are not addressable.
	 * @throws ApiException `PAYMENT_TERM_PERCENT_SUM` (400) when the percentages do not total 100.
	 */
	async updateLines(id: ID, lines: IPaymentTermLineInput[]): Promise<PaymentTerm> {
		await this.getTerm(id);

		const normalized = this.normalizeLines(lines);
		this.assertLinesAddressable(normalized);
		this.assertPercentages(normalized);

		await this.paymentTermLineService.replaceLines(id, normalized);

		return this.getTerm(id);
	}

	/**
	 * Derives the schedule a term produces for one document.
	 *
	 * @param termOrId The term, or its id.
	 * @param total The document total, an exact decimal.
	 * @param currencyDecimals The document currency's decimal places: the scale every instalment is a
	 * whole number of, and therefore the scale the allocation is exact at.
	 * @param basisDate The document's own basis date. Only its calendar date is read.
	 * @param currency The document currency. When omitted it is taken from the term's fixed lines, which
	 * is the only place a term states one.
	 * @returns The instalments, their dates, and the total they allocate.
	 * @throws ApiException `PAYMENT_TERM_OVERALLOCATED` (422) when the instalments allocate more than the
	 * document total, or leave a remainder no percentage line can take.
	 * @throws ApiException `PAYMENT_TERM_LINES_INVALID` (400) when a fixed instalment's currency
	 * disagrees with the document's.
	 * @throws NotFoundException when the term does not exist for this organization.
	 */
	async schedule(
		termOrId: PaymentTerm | ID,
		total: DecimalString,
		currencyDecimals: number,
		basisDate: Date | string,
		currency?: CurrencyCode
	): Promise<IPaymentTermSchedule> {
		const term = typeof termOrId === 'string' ? await this.getTerm(termOrId) : termOrId;
		const lines = term.lines ?? (await this.paymentTermLineService.listByTerm(term.id));
		const documentCurrency = currency ?? lines.find((line) => line.currency)?.currency;

		if (!documentCurrency) {
			throw new ApiException(
				HttpStatus.BAD_REQUEST,
				ApiErrorCode.PAYMENT_TERM_LINES_INVALID,
				'A schedule needs the document currency: a term whose lines are all percentages does not state one.',
				{ field: 'currency' }
			);
		}

		this.assertLinesAddressable(lines);

		const decimalPlaces = Number.isInteger(currencyDecimals) && currencyDecimals >= 0 ? currencyDecimals : 2;
		const whole = Money.of(normalizeDecimalString(total), documentCurrency, decimalPlaces);
		const basis = toIsoDate(basisDate);

		const fixed = [...lines].filter((line) => line.valueType === PaymentTermLineType.FIXED).sort(bySequence);
		const percent = [...lines].filter((line) => line.valueType === PaymentTermLineType.PERCENT).sort(bySequence);

		// A fixed instalment is an amount in the document's currency. One stated in another currency is
		// not convertible here — a term carries no rate — so it is refused rather than assumed.
		for (const line of fixed) {
			if (line.currency && line.currency !== documentCurrency) {
				throw new ApiException(
					HttpStatus.BAD_REQUEST,
					ApiErrorCode.PAYMENT_TERM_LINES_INVALID,
					`A fixed instalment of "${term.code}" is stated in ${line.currency} while the document is in ${documentCurrency}.`,
					{ field: 'currency' }
				);
			}
		}

		const fixedTotal = Money.sum(
			fixed.map((line) => Money.of(normalizeDecimalString(line.valueAmount), documentCurrency, decimalPlaces)),
			documentCurrency,
			decimalPlaces
		).round(undefined, decimalPlaces);

		const remainder = whole.subtract(fixedTotal);

		if (remainder.isNegative()) {
			throw new ApiException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ApiErrorCode.PAYMENT_TERM_OVERALLOCATED,
				`The fixed instalments of "${term.code}" allocate ${fixedTotal.amount} of a ${whole.amount} document.`,
				{ total: whole.amount, fixed: fixedTotal.amount }
			);
		}

		if (percent.length === 0 && remainder.isPositive()) {
			throw new ApiException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ApiErrorCode.PAYMENT_TERM_OVERALLOCATED,
				`The instalments of "${term.code}" allocate ${fixedTotal.amount} of a ${whole.amount} document and no percentage instalment takes the rest.`,
				{ total: whole.amount, fixed: fixedTotal.amount }
			);
		}

		// The allocator is the platform's: the parts sum back to the whole exactly, at the currency's
		// scale, so a schedule never leaves a minor unit unaccounted for.
		const shares: Money[] = percent.length > 0 ? remainder.allocate(percent.map((line) => line.valueAmount)) : [];

		const instalments: IPaymentTermInstalment[] = [
			...fixed.map((line) => this.instalmentOf(line, normalizeDecimalString(line.valueAmount), documentCurrency, basis, undefined)),
			...percent.map((line, index) =>
				this.instalmentOf(line, shares[index].amount, documentCurrency, basis, normalizeDecimalString(line.valueAmount))
			)
		].sort(bySequence);

		const merged = mergeSameDate(instalments, documentCurrency, decimalPlaces);
		const allocatedTotal = Money.sum(
			merged.map((instalment) => Money.of(instalment.amount, documentCurrency, decimalPlaces)),
			documentCurrency,
			decimalPlaces
		).round(undefined, decimalPlaces);

		return {
			paymentTermId: term.id,
			code: term.code,
			name: term.name,
			total: whole.amount,
			currency: documentCurrency,
			currencyDecimals: decimalPlaces,
			basisDate: basis,
			instalments: merged,
			allocatedTotal: allocatedTotal.amount,
			dueDate: merged.length > 0 ? merged[merged.length - 1].dueDate : basis
		};
	}

	/**
	 * Builds one instalment: its amount and the date its basis puts it on.
	 *
	 * @param line The instalment's line.
	 * @param amount The amount the allocation gave it.
	 * @param currency The document currency.
	 * @param basisDate The document's basis date, as `YYYY-MM-DD`.
	 * @param percentage The line's share of the total, when it states one.
	 * @returns The instalment.
	 */
	private instalmentOf(
		line: PaymentTermLine,
		amount: DecimalString,
		currency: CurrencyCode,
		basisDate: string,
		percentage?: DecimalString
	): IPaymentTermInstalment {
		const dayOfMonth = line.dayOfMonth ?? undefined;

		return {
			sequence: line.sequence,
			sequences: [line.sequence],
			dueDate: dueDateFor(basisDate, line.dueBasis, line.days ?? 0, dayOfMonth),
			amount,
			currency,
			valueType: line.valueType,
			...(percentage === undefined ? {} : { percentage }),
			dueBasis: line.dueBasis,
			days: line.days ?? 0,
			...(dayOfMonth === undefined ? {} : { dayOfMonth })
		};
	}

	/**
	 * Fills the defaults of a set of supplied lines and orders them.
	 *
	 * @param lines The lines as supplied.
	 * @returns The lines with a sequence, a type, a basis and a day count.
	 */
	private normalizeLines(lines?: IPaymentTermLineInput[]): IPaymentTermLineInput[] {
		if (!Array.isArray(lines)) {
			return [];
		}

		return lines
			.map((line, index) => ({
				valueType: PaymentTermLineType.PERCENT,
				dueBasis: PaymentDueBasis.INVOICE_DATE,
				days: 0,
				...line,
				sequence: line.sequence ?? index + 1
			}))
			.sort(bySequence);
	}

	/**
	 * Refuses a schedule that cannot be read: no instalments at all, two sharing a sequence, a fixed
	 * instalment with no currency, or a day-of-month basis with no day.
	 *
	 * @param lines The lines to check.
	 * @throws ApiException `PAYMENT_TERM_LINES_INVALID` (400).
	 */
	private assertLinesAddressable(lines: Array<PaymentTermLine | IPaymentTermLineInput>): void {
		if (lines.length === 0) {
			throw new ApiException(
				HttpStatus.BAD_REQUEST,
				ApiErrorCode.PAYMENT_TERM_LINES_INVALID,
				'A settlement term carries at least one instalment; a term with no schedule settles nothing.',
				{ field: 'lines' }
			);
		}

		const sequences = new Set<number>();

		for (const line of lines) {
			const sequence = Number(line.sequence);

			if (sequences.has(sequence)) {
				throw new ApiException(
					HttpStatus.BAD_REQUEST,
					ApiErrorCode.PAYMENT_TERM_LINES_INVALID,
					`Two instalments share the sequence ${sequence}; an instalment is addressed by its position.`,
					{ field: 'sequence' }
				);
			}

			sequences.add(sequence);

			if (line.valueType === PaymentTermLineType.FIXED && !line.currency) {
				throw new ApiException(
					HttpStatus.BAD_REQUEST,
					ApiErrorCode.PAYMENT_TERM_LINES_INVALID,
					'A fixed instalment states the currency of its amount.',
					{ field: 'currency' }
				);
			}

			if (line.dueBasis === PaymentDueBasis.DAY_OF_NEXT_MONTH && !line.dayOfMonth) {
				throw new ApiException(
					HttpStatus.BAD_REQUEST,
					ApiErrorCode.PAYMENT_TERM_LINES_INVALID,
					'A `DAY_OF_NEXT_MONTH` instalment states the day of the month it falls on.',
					{ field: 'dayOfMonth' }
				);
			}
		}
	}

	/**
	 * Refuses a schedule whose percentages cannot cover the document when nothing else does.
	 *
	 * With no fixed instalment, the percentage lines are the whole schedule, so they must total exactly
	 * `100`. This is the check that catches a typo before it reaches a document: a `30/70` schedule
	 * written as `30/07` allocates less than the total, and without this nothing would notice until an
	 * invoice was a tenth short.
	 *
	 * @param lines The lines to check.
	 * @throws ApiException `PAYMENT_TERM_PERCENT_SUM` (400).
	 */
	private assertPercentages(lines: Array<PaymentTermLine | IPaymentTermLineInput>): void {
		if (lines.some((line) => line.valueType === PaymentTermLineType.FIXED)) {
			// A fixed instalment takes its part of the total, so the percentage lines need not total 100:
			// they split whatever is left, in the proportion they state.
			return;
		}

		const total = lines.reduce(
			(sum, line) => addDecimalStrings(sum, normalizeDecimalString(line.valueAmount)),
			'0'
		);

		if (compareDecimalStrings(total, '100') !== 0) {
			throw new ApiException(
				HttpStatus.BAD_REQUEST,
				ApiErrorCode.PAYMENT_TERM_PERCENT_SUM,
				`The percentage instalments total ${total}, and a term with no fixed instalment allocates the whole document.`,
				{ field: 'valueAmount' }
			);
		}
	}
}

/**
 * Orders two things that carry a sequence.
 *
 * @param left One line or instalment.
 * @param right Another.
 * @returns The comparison, ascending by sequence.
 */
function bySequence(left: { sequence: number }, right: { sequence: number }): number {
	return left.sequence - right.sequence;
}

/**
 * Merges the instalments that fall on the same date.
 *
 * Two amounts due the same day are one amount due that day, so a schedule that presented them
 * separately would ask a payer to make two transfers where the agreement calls for one. The merged
 * instalment keeps the first sequence of the group and names every sequence it absorbed, so a caller
 * can still trace it back to the lines it came from.
 *
 * @param instalments The instalments, in sequence order.
 * @param currency The document currency.
 * @param decimalPlaces The document currency's decimal places.
 * @returns The merged instalments, in date order.
 */
function mergeSameDate(
	instalments: IPaymentTermInstalment[],
	currency: CurrencyCode,
	decimalPlaces: number
): IPaymentTermInstalment[] {
	const groups = new Map<string, IPaymentTermInstalment[]>();

	for (const instalment of instalments) {
		groups.set(instalment.dueDate, [...(groups.get(instalment.dueDate) ?? []), instalment]);
	}

	return [...groups.entries()]
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		.map(([dueDate, group]) => {
			const ordered = [...group].sort(bySequence);
			const first = ordered[0];

			if (ordered.length === 1) {
				return first;
			}

			const amount = Money.sum(
				ordered.map((instalment) => Money.of(instalment.amount, currency, decimalPlaces)),
				currency,
				decimalPlaces
			).round(undefined, decimalPlaces);

			// A merged instalment's share is the sum of the shares it absorbed, and only when every one of
			// them stated a share: a group that mixes a fixed and a percentage instalment has no single
			// percentage that means anything.
			const shares = ordered.map((instalment) => instalment.percentage);
			const stated = shares.every((share) => share !== undefined);
			const merged: IPaymentTermInstalment = {
				...first,
				dueDate,
				amount: amount.amount,
				sequences: ordered.map((instalment) => instalment.sequence)
			};

			if (stated) {
				merged.percentage = shares.reduce((sum: DecimalString, share) => addDecimalStrings(sum, share as DecimalString), '0');
			} else {
				delete merged.percentage;
			}

			return merged;
		});
}

/**
 * The date one instalment falls due.
 *
 * Every calculation is done in UTC and on the calendar date alone: a due date is a day, not an instant,
 * and reading it in the server's timezone would move it by a day for half the world.
 *
 * @param basisDate The document's basis date, as `YYYY-MM-DD`.
 * @param dueBasis Where the offset is counted from.
 * @param days The offset.
 * @param dayOfMonth The day of the following month, for `DAY_OF_NEXT_MONTH`.
 * @returns The due date, as `YYYY-MM-DD`.
 */
export function dueDateFor(
	basisDate: string,
	dueBasis: PaymentDueBasis,
	days: number,
	dayOfMonth?: number
): string {
	const basis = new Date(`${basisDate}T00:00:00.000Z`);

	switch (dueBasis) {
		case PaymentDueBasis.END_OF_MONTH:
			return addDays(endOfMonth(basis), days);
		case PaymentDueBasis.END_OF_NEXT_MONTH:
			return addDays(endOfMonth(new Date(Date.UTC(basis.getUTCFullYear(), basis.getUTCMonth() + 1, 1))), days);
		case PaymentDueBasis.DAY_OF_NEXT_MONTH:
			// A day the month does not have clamps to its last: "the 31st of the following month" in a
			// 30-day month is the 30th, which is what a payer understands by it.
			return dayOfFollowingMonth(basis, dayOfMonth ?? 1);
		case PaymentDueBasis.INVOICE_DATE:
		default:
			return addDays(basis, days);
	}
}

/**
 * @param date A date.
 * @param days A whole number of days.
 * @returns The date shifted by them, as `YYYY-MM-DD`.
 */
function addDays(date: Date, days: number): string {
	return new Date(date.getTime() + Math.trunc(days) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * @param date A date.
 * @returns The last day of its month, at midnight UTC.
 */
function endOfMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/**
 * @param basis A date.
 * @param dayOfMonth The day wanted in the following month.
 * @returns That day of the following month, clamped to the month's length.
 */
function dayOfFollowingMonth(basis: Date, dayOfMonth: number): string {
	const first = new Date(Date.UTC(basis.getUTCFullYear(), basis.getUTCMonth() + 1, 1));
	const last = endOfMonth(first);
	const day = Math.min(Math.max(1, Math.trunc(dayOfMonth)), last.getUTCDate());

	return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)).toISOString().slice(0, 10);
}

/**
 * @param value A date or an ISO date string.
 * @returns The calendar date, as `YYYY-MM-DD`.
 * @throws ApiException when the value is not a date.
 */
function toIsoDate(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.VALIDATION_FAILED,
			'A schedule needs the document date it is counted from.',
			{ field: 'basisDate' }
		);
	}

	return date.toISOString().slice(0, 10);
}
