import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL } from '@gauzy/config';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, Money, RequestContext } from '@gauzy/core';
import { RefundLine } from './refund-line.entity';
import { TypeOrmRefundLineRepository } from './repository/type-orm-refund-line.repository';
import { MikroOrmRefundLineRepository } from './repository/mikro-orm-refund-line.repository';
import { Refund } from '../refund/refund.entity';
import { IRefund, IRefundLine, IRefundLineCreateInput, IRefundLineUpdateInput, RefundStatus } from '../payment.types';

/** A line of a refund, once its magnitudes have been read as exact decimals. */
interface IPreparedRefundLine {
	readonly orderLineId: ID;
	readonly quantity: DecimalString;
	readonly amount: DecimalString;
	readonly currency: string;
	readonly metadata?: Record<string, unknown>;
}

/**
 * Which lines a refund paid back.
 *
 * **The breakdown is rows, and the table is what makes the rule enforceable.** The refund's own
 * amount is the ceiling of the sum of its lines, the pair `(refund, order line)` is unique among live
 * rows, and a line is written in the same transaction as the refund it belongs to — so the two can
 * never disagree about what was given back.
 *
 * Three things this service is deliberately strict about. A line must name an **order line of the
 * caller's own organization**: the amount is attributed to a line of an order, and an amount
 * attributed to a line that is not there is an attribution nobody can reconcile, so the write is
 * refused rather than stored. A line's **identity does not move**: a different order line is a
 * different line, and it is added rather than rewritten. And the breakdown of a **settled** refund is
 * a record — once the refund has left `PENDING` the money has moved or the intention has been
 * withdrawn, and neither is something a line may be edited to describe.
 *
 * A refund written before this table existed carries its breakdown in `refund.metadata.lineRefunds[]`.
 * That array is still **read** — `findLines` answers with it when the refund has no rows, marking each
 * entry `legacy` — and it is never written: a line is a row from here on, and the two shapes never
 * both exist on one refund.
 */
@Injectable()
export class RefundLineService extends CrudService<RefundLine> {
	/**
	 * A decimal a `numeric(20,6)` quantity column carries: at most fourteen integer digits and six
	 * fractional ones, and never an exponent.
	 */
	private static readonly QUANTITY_PATTERN = /^\d{1,14}(\.\d{1,6})?$/;

	constructor(
		readonly typeOrmRefundLineRepository: TypeOrmRefundLineRepository,
		readonly mikroOrmRefundLineRepository: MikroOrmRefundLineRepository
	) {
		super(typeOrmRefundLineRepository, mikroOrmRefundLineRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Quotes an identifier for the active dialect, so one statement body serves all three.
	 *
	 * The order line is a table this package reads but does not own, so it is read by name; the
	 * columns of this platform are camelCase and quoted, which is why the quoting is spelled here
	 * rather than left to the database's own folding.
	 *
	 * @param identifier The column, table or alias name to quote.
	 * @returns The quoted identifier.
	 */
	private q(identifier: string): string {
		return isMySQL() ? `\`${identifier}\`` : `"${identifier}"`;
	}

	/**
	 * Writes the line breakdown of a refund, inside the caller's transaction.
	 *
	 * Called by the refund service with the manager its transaction is running on, so the refund row
	 * and the lines that explain it are written together or not at all. Every line is checked before
	 * anything is written: the order lines have to resolve inside the caller's organization, the
	 * magnitudes have to be positive exact decimals, and the sum may not pass the refund's own amount.
	 *
	 * @param manager The manager of the transaction the refund is being written in.
	 * @param refund The refund the lines belong to.
	 * @param lines The breakdown to write.
	 * @returns The stored lines, in the order they were supplied.
	 * @throws BadRequestException when a line names an order line this organization does not have,
	 * when its magnitudes are not positive exact decimals, or when the lines would account for more
	 * than the refund gives back.
	 */
	async appendLines(manager: EntityManager, refund: IRefund, lines: IRefundLineCreateInput[]): Promise<IRefundLine[]> {
		if (!lines?.length) {
			return [];
		}

		const prepared = await this.prepareLines(manager, refund, lines);
		const rows = prepared.map((line) =>
			manager.create(RefundLine, {
				...line,
				refundId: refund.id,
				tenantId: refund.tenantId ?? this.scope.tenantId,
				organizationId: refund.organizationId ?? this.scope.organizationId
			} as Partial<RefundLine>)
		);

		return manager.save(RefundLine, rows);
	}

	/**
	 * Records one line against a pending refund.
	 *
	 * @param input The line to record, and the refund it accounts for.
	 * @returns The stored line.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 * @throws BadRequestException when the refund has settled, when it already accounts for that order
	 * line, or when the line is not writable.
	 */
	async createLine(input: IRefundLineCreateInput & { refundId: ID }): Promise<IRefundLine> {
		if (!input.refundId) {
			throw new BadRequestException('REFUND_LINE_REFUND_REQUIRED');
		}

		return this.typeOrmRefundLineRepository.manager.transaction(async (manager) => {
			const refund = await this.findRefundOrFail(input.refundId, manager);
			this.assertRefundPending(refund);

			// The line is read and checked before the pair is looked up, so a request that names no order
			// line is refused for that reason rather than reported as a duplicate of one it never named.
			const prepared = await this.prepareLines(manager, refund, [input]);
			const duplicate = await manager.findOne(RefundLine, {
				where: { refundId: refund.id, orderLineId: prepared[0].orderLineId, ...this.scope }
			});

			if (duplicate) {
				throw new BadRequestException(
					`REFUND_LINE_EXISTS: refund ${refund.id} already accounts for order line ${prepared[0].orderLineId}.`
				);
			}

			const row = manager.create(RefundLine, {
				...prepared[0],
				refundId: refund.id,
				tenantId: refund.tenantId ?? this.scope.tenantId,
				organizationId: refund.organizationId ?? this.scope.organizationId
			} as Partial<RefundLine>);

			return manager.save(RefundLine, row);
		});
	}

	/**
	 * Changes what a line of a pending refund records: its quantity, its amount and its metadata.
	 *
	 * @param id The line to change.
	 * @param input The fields to change.
	 * @returns The stored line.
	 * @throws NotFoundException when the line is not in the caller's organization.
	 * @throws BadRequestException when the refund has settled, when the request would move the line to
	 * another order line or refund, or when the change is not writable.
	 */
	async updateLine(id: ID, input: IRefundLineUpdateInput): Promise<IRefundLine> {
		const line = await this.findLineOrFail(id);

		if (input.refundId && input.refundId !== line.refundId) {
			throw new BadRequestException(
				`REFUND_LINE_REFUND_IMMUTABLE: line ${id} accounts for refund ${line.refundId} and cannot be moved.`
			);
		}

		if (input.orderLineId && input.orderLineId !== line.orderLineId) {
			throw new BadRequestException(
				`REFUND_LINE_ORDER_LINE_IMMUTABLE: line ${id} explains order line ${line.orderLineId}; a different order line is a different line.`
			);
		}

		return this.typeOrmRefundLineRepository.manager.transaction(async (manager) => {
			const stored = await manager.findOne(RefundLine, { where: { id, ...this.scope } });

			if (!stored) {
				throw new NotFoundException('REFUND_LINE_NOT_FOUND');
			}

			const refund = await this.findRefundOrFail(stored.refundId, manager);
			this.assertRefundPending(refund);

			const prepared = await this.prepareLines(
				manager,
				refund,
				[
					{
						orderLineId: stored.orderLineId,
						quantity: input.quantity ?? stored.quantity,
						amount: input.amount ?? stored.amount,
						currency: input.currency ?? stored.currency,
						metadata: input.metadata ?? stored.metadata
					}
				],
				stored.id
			);

			stored.quantity = prepared[0].quantity;
			stored.amount = prepared[0].amount;
			stored.currency = prepared[0].currency;

			if (input.metadata !== undefined) {
				stored.metadata = prepared[0].metadata;
			}

			return manager.save(RefundLine, stored);
		});
	}

	/**
	 * Removes a line from a refund that has not settled.
	 *
	 * The row is deleted softly, like every other row of this platform: the live-pair uniqueness of
	 * `(refund, order line)` is a predicate on `deletedAt`, so the line can be recorded again without
	 * the removed one blocking it.
	 *
	 * @param id The line to remove.
	 * @returns The line as it stood before it was removed.
	 * @throws NotFoundException when the line is not in the caller's organization.
	 * @throws BadRequestException when the refund has settled.
	 */
	async removeLine(id: ID): Promise<IRefundLine> {
		const line = await this.findLineOrFail(id);
		const refund = await this.findRefundOrFail(line.refundId);

		this.assertRefundPending(refund);
		await this.softDelete(id);

		return line;
	}

	/**
	 * The lines of a refund: the rows it has, and otherwise the breakdown a refund written before this
	 * table existed carries in its metadata.
	 *
	 * @param refundId The refund to read.
	 * @returns The lines, each marked `legacy` when it came from the metadata array rather than from a
	 * row.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 */
	async findLines(refundId: ID): Promise<IRefundLine[]> {
		const refund = await this.findRefundOrFail(refundId);
		const lines = await this.find({
			where: { refundId, ...this.scope } as never,
			order: { createdAt: 'ASC' } as never
		});

		if (lines.length) {
			return lines.map((line) => ({ ...line, legacy: false }));
		}

		return this.legacyLines(refund);
	}

	/**
	 * Loads a line that belongs to the caller's organization.
	 *
	 * @param id The line to load.
	 * @returns The line.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findLineOrFail(id: ID): Promise<IRefundLine> {
		const line = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!line) {
			throw new NotFoundException('REFUND_LINE_NOT_FOUND');
		}

		return line;
	}

	/**
	 * Paginates the lines of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of lines.
	 */
	async findLinesPage(options: Record<string, unknown> = {}): Promise<IPagination<IRefundLine>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Sums the lines of a refund, which is what the refund's own amount is the ceiling of.
	 *
	 * @param refundId The refund to sum for.
	 * @returns The line total as an exact decimal.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 */
	async sumLinesForRefund(refundId: ID): Promise<DecimalString> {
		const lines = await this.findLines(refundId);
		const currency = lines.length ? lines[0].currency : undefined;

		if (!currency) {
			return '0';
		}

		return Money.sum(
			lines.map((line) => Money.of(line.amount, currency)),
			currency
		).amount;
	}

	/**
	 * Reads and checks a set of lines against the refund they are written for.
	 *
	 * @param manager The manager to read through.
	 * @param refund The refund the lines belong to.
	 * @param lines The lines as they were supplied.
	 * @param excludedLineId The line being updated, which does not count towards the refund's own
	 * ceiling twice.
	 * @returns The lines, normalised.
	 * @throws BadRequestException when a line is not writable, names an order line this organization
	 * does not have, or takes the breakdown past the refund.
	 */
	private async prepareLines(
		manager: EntityManager,
		refund: IRefund,
		lines: IRefundLineCreateInput[],
		excludedLineId?: ID
	): Promise<IPreparedRefundLine[]> {
		const currency = refund.currency;
		const prepared = lines.map((line) => this.prepareLine(refund, line, currency));

		await this.assertOrderLines(manager, prepared);
		await this.assertWithinRefund(manager, refund, prepared, excludedLineId);

		return prepared;
	}

	/**
	 * Reads one supplied line as the row it will become.
	 *
	 * @param refund The refund the line belongs to.
	 * @param line The line as it was supplied.
	 * @param currency The refund's currency.
	 * @returns The line, normalised.
	 * @throws BadRequestException when the line names no order line, when its currency is not the
	 * refund's, or when its magnitudes are not positive exact decimals.
	 */
	private prepareLine(refund: IRefund, line: IRefundLineCreateInput, currency: string): IPreparedRefundLine {
		if (!line?.orderLineId) {
			throw new BadRequestException('REFUND_LINE_ORDER_LINE_REQUIRED');
		}

		if (
			line.currency &&
			currency &&
			line.currency.trim().toUpperCase() !== currency.trim().toUpperCase()
		) {
			throw new BadRequestException(
				`Refund line currency '${line.currency}' does not match refund currency '${currency}'.`
			);
		}

		// A line written with its refund knows which refund that is; one that names a different refund
		// is a mistake rather than a second breakdown, so it is refused instead of quietly re-pointed.
		if (line.refundId && line.refundId !== refund.id) {
			throw new BadRequestException(
				`REFUND_LINE_REFUND_MISMATCH: line names refund ${line.refundId} but is written for refund ${refund.id}.`
			);
		}

		return {
			orderLineId: line.orderLineId,
			quantity: this.toQuantity(line.quantity),
			amount: this.toMoney(line.amount, currency),
			currency,
			...(line.metadata ? { metadata: line.metadata } : {})
		};
	}

	/**
	 * Checks that every order line a breakdown cites is an order line of the caller's organization.
	 *
	 * The order aggregate is a peer package, so its table is read by name through the caller's own
	 * manager — inside the writing transaction, which is what keeps the check and the write from
	 * disagreeing. The read is scoped by the caller's tenant and organization, and it fails closed
	 * when the caller has no scope to read with.
	 *
	 * @param manager The manager to read through.
	 * @param lines The lines about to be written.
	 * @throws BadRequestException when the caller has no scope, or when an order line does not resolve.
	 */
	private async assertOrderLines(manager: EntityManager, lines: IPreparedRefundLine[]): Promise<void> {
		const { tenantId, organizationId } = this.scope;

		if (!tenantId || !organizationId) {
			throw new BadRequestException(
				'REFUND_LINE_SCOPE_REQUIRED: a line can only be attributed to an order line of a known tenant and organization.'
			);
		}

		const ids = [...new Set(lines.map((line) => line.orderLineId))];
		const orderLine = this.q('orderLine');

		const rows: Array<{ id: ID }> = await manager
			.createQueryBuilder()
			.select(`${orderLine}.${this.q('id')}`, 'id')
			.from('order_line', 'orderLine')
			.where(`${orderLine}.${this.q('id')} IN (:...orderLineIds)`, { orderLineIds: ids })
			.andWhere(`${orderLine}.${this.q('deletedAt')} IS NULL`)
			.andWhere(`${orderLine}.${this.q('tenantId')} = :tenantId`, { tenantId })
			.andWhere(`${orderLine}.${this.q('organizationId')} = :organizationId`, { organizationId })
			.getRawMany();

		const known = new Set((rows ?? []).map((row) => row.id));

		for (const id of ids) {
			if (!known.has(id)) {
				throw new BadRequestException(
					`REFUND_LINE_ORDER_LINE_NOT_FOUND: order line ${id} is not an order line of this organization.`
				);
			}
		}
	}

	/**
	 * Refuses a breakdown that would account for more than the refund gives back.
	 *
	 * @param manager The manager to read the stored lines through.
	 * @param refund The refund the lines belong to.
	 * @param lines The lines about to be written.
	 * @param excludedLineId The line being updated, which is replaced rather than added.
	 * @throws BadRequestException when the sum would pass the refund's amount.
	 */
	private async assertWithinRefund(
		manager: EntityManager,
		refund: IRefund,
		lines: IPreparedRefundLine[],
		excludedLineId?: ID
	): Promise<void> {
		const currency = refund.currency;
		const stored = (await this.storedLines(manager, refund.id)).filter((line) => line.id !== excludedLineId);
		const accounted = Money.sum(
			stored.map((line) => Money.of(line.amount, currency)),
			currency
		);
		const added = Money.sum(
			lines.map((line) => Money.of(line.amount, currency)),
			currency
		);
		const total = accounted.add(added);
		const ceiling = Money.of(refund.amount, currency);

		if (total.greaterThan(ceiling)) {
			throw new BadRequestException(
				`REFUND_LINE_OVER_REFUND: the lines of refund ${refund.id} would account for ` +
					`${total.amount} ${currency} of the ${refund.amount} ${currency} it gives back.`
			);
		}
	}

	/**
	 * The stored lines of a refund, read through a transaction when there is one.
	 *
	 * @param manager The manager of the writing transaction, when the caller has one.
	 * @param refundId The refund to read.
	 * @returns The stored lines.
	 */
	private async storedLines(manager: EntityManager | undefined, refundId: ID): Promise<IRefundLine[]> {
		if (manager) {
			return manager.find(RefundLine, { where: { refundId, ...this.scope } });
		}

		return this.find({ where: { refundId, ...this.scope } as never });
	}

	/**
	 * Loads a refund that belongs to the caller's organization.
	 *
	 * @param refundId The refund to load.
	 * @param manager The manager of the writing transaction, when the caller has one.
	 * @returns The refund.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	private async findRefundOrFail(refundId: ID, manager?: EntityManager): Promise<IRefund> {
		const reader = manager ?? this.typeOrmRefundLineRepository.manager;
		const refund = await reader.findOne(Refund, { where: { id: refundId, ...this.scope } });

		if (!refund) {
			throw new NotFoundException('REFUND_NOT_FOUND');
		}

		return refund;
	}

	/**
	 * Refuses a write to the breakdown of a refund that has settled.
	 *
	 * @param refund The refund being written against.
	 * @throws BadRequestException when the refund is no longer pending.
	 */
	private assertRefundPending(refund: IRefund): void {
		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException(
				`REFUND_LINE_REFUND_SETTLED: refund ${refund.id} is ${refund.status}; what it paid back is a record.`
			);
		}
	}

	/**
	 * Reads the per-line breakdown a refund written before this table existed carries in its metadata.
	 *
	 * This is a **read path and only a read path**: the refunds that stored their lines as
	 * `metadata.lineRefunds[]` have to keep answering with the lines they recorded, and every refund
	 * written from here on writes rows instead and carries no array at all.
	 *
	 * @param refund The refund to read.
	 * @returns The lines the array recorded, each marked `legacy`.
	 */
	private legacyLines(refund: IRefund): IRefundLine[] {
		const entries = refund.metadata?.['lineRefunds'];

		if (!Array.isArray(entries)) {
			return [];
		}

		return entries
			.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
			.map((entry) => ({
				refundId: refund.id,
				orderLineId: entry['orderLineId'] as ID,
				quantity: (entry['quantity'] as DecimalString) ?? '0',
				amount: (entry['amount'] as DecimalString) ?? '0',
				currency: refund.currency,
				tenantId: refund.tenantId,
				organizationId: refund.organizationId,
				legacy: true
			}))
			.filter((line) => Boolean(line.orderLineId));
	}

	/**
	 * Reads a line quantity. A quantity is a count of units, never an amount of money, so it is read
	 * as an exact decimal at the storage scale rather than through the money layer.
	 *
	 * @param value The quantity to read.
	 * @returns The quantity as a decimal string.
	 * @throws BadRequestException when the value is not a positive exact decimal.
	 */
	private toQuantity(value: DecimalString | number): DecimalString {
		const text = (typeof value === 'number' ? String(value) : `${value ?? ''}`).trim();

		// A quantity column holds a positive magnitude, and after the shape check a decimal is positive
		// exactly when one of its digits is not zero.
		if (!RefundLineService.QUANTITY_PATTERN.test(text) || !/[1-9]/.test(text)) {
			throw new BadRequestException(
				'REFUND_LINE_QUANTITY_INVALID: a line quantity is a positive exact decimal of at most six fractional digits.'
			);
		}

		return text;
	}

	/**
	 * Reads a line amount in a given currency.
	 *
	 * @param value The amount to read.
	 * @param currency The currency it is in.
	 * @returns The amount as an exact decimal.
	 * @throws BadRequestException when the amount is not a positive exact decimal.
	 */
	private toMoney(value: DecimalString | number, currency: string): DecimalString {
		let amount: Money;

		try {
			amount = Money.of(value, currency);
		} catch {
			throw new BadRequestException('REFUND_LINE_AMOUNT_INVALID');
		}

		if (!amount.isPositive()) {
			throw new BadRequestException('REFUND_LINE_AMOUNT_INVALID');
		}

		return amount.amount;
	}
}
