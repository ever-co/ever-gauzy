import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	CurrencyCode,
	ID,
	IPagination,
	SellerSettlementStatus
} from '@gauzy/contracts';
import { EventOutboxService, Money, RequestContext, TenantAwareCrudService, compareDecimalStrings } from '@gauzy/core';
import { SellerSettlement } from './seller-settlement.entity';
import { MikroOrmSellerSettlementRepository } from './repository/mikro-orm-seller-settlement.repository';
import { TypeOrmSellerSettlementRepository } from './repository/type-orm-seller-settlement.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { ISellerScope, assertSellerScope } from '../seller-scope/seller-scope';
import { assertNoLifecycleMembers } from '../lifecycle-members';

/**
 * The members of a settlement only its own operations write, which an edit therefore refuses.
 *
 * - `status` and what records its moves (`reconciledAt`, `reconciledByUserId`, `closedAt`) — moved by
 *   reconcile, close and dispute, each with its own checks: a closed settlement is final, a dispute needs
 *   a reason;
 * - the figures (`grossAmount`, `commissionAmount`, `feeAmount`, `netAmount`, `discrepancyAmount`,
 *   `settlementAmount`, `settlementCurrency`, `fxRate`, `fxCapturedAt`) — the provider's report as recorded,
 *   the net derived from it and the discrepancy the reconciliation computed; a caller that could set the
 *   net could state one its own gross, commission and fee do not produce, and one that could set the
 *   discrepancy could silence the one number the report exists to surface;
 * - what the settlement is of (`sellerId`, `providerKey`, `currency`, `currencyDecimals`, `payoutId`) —
 *   which never change once it is recorded.
 */
export const SELLER_SETTLEMENT_LIFECYCLE_MEMBERS: readonly string[] = [
	'status',
	'reconciledAt',
	'reconciledByUserId',
	'closedAt',
	'grossAmount',
	'commissionAmount',
	'feeAmount',
	'netAmount',
	'discrepancyAmount',
	'settlementAmount',
	'settlementCurrency',
	'fxRate',
	'fxCapturedAt',
	'sellerId',
	'providerKey',
	'currency',
	'currencyDecimals',
	'payoutId'
];

/**
 * Records what a provider reported, and reconciles it against the platform's own ledger.
 *
 * The single most important property here is what the service **refuses** to do: it never edits a
 * ledger row to make the platform agree with a provider. A difference is stored as
 * `discrepancyAmount`, requires a note and is reported; the reconciliation is a report a finance
 * function reads, not a repair.
 */
@Injectable()
export class SellerSettlementService extends TenantAwareCrudService<SellerSettlement> {
	constructor(
		readonly typeOrmSellerSettlementRepository: TypeOrmSellerSettlementRepository,
		readonly mikroOrmSellerSettlementRepository: MikroOrmSellerSettlementRepository,
		private readonly transactionRepository: TypeOrmSellerTransactionRepository,
		private readonly outbox: EventOutboxService
	) {
		super(typeOrmSellerSettlementRepository, mikroOrmSellerSettlementRepository);
	}

	/** Lists settlements, narrowed to the caller's seller unless it is staff. */
	async listSettlements(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerSettlement>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff) {
			assertSellerScope(scope, where.sellerId);
			where.sellerId = scope.sellerId;
		}

		return this.paginate({ ...filter, where });
	}

	/** Reads one settlement. */
	async getSettlement(id: ID, scope?: ISellerScope): Promise<SellerSettlement> {
		const settlement = await this.typeOrmSellerSettlementRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerSettlement>
		});

		if (!settlement) {
			throw new NotFoundException('The settlement does not exist.');
		}

		if (scope && !scope.staff) {
			assertSellerScope(scope, settlement.sellerId);
		}

		return settlement;
	}

	/**
	 * Records a settlement exactly as the provider reported it.
	 *
	 * The provider's own figures are stored as given, including its fee, which is not the platform's
	 * commission and is never netted into it. The report id is unique per provider, so a replayed
	 * callback cannot create a second settlement and a retried client cannot move money twice.
	 *
	 * @param input The settlement as the provider reported it.
	 * @param scope The caller's seller scope.
	 * @returns The recorded settlement.
	 */
	async record(input: Partial<SellerSettlement>, scope?: ISellerScope): Promise<SellerSettlement> {
		if (!input.sellerId || !input.providerKey || !input.currency) {
			throw new BadRequestException('A settlement needs a seller, a provider and a currency.');
		}

		if (scope && !scope.staff) {
			assertSellerScope(scope, input.sellerId);
		}

		const decimals = input.currencyDecimals ?? 2;
		const currency = input.currency as CurrencyCode;

		const gross = Money.fromStorage(input.grossAmount, currency, decimals);
		const commission = Money.fromStorage(input.commissionAmount, currency, decimals);
		const fee = Money.fromStorage(input.feeAmount, currency, decimals);
		const net = gross.subtract(commission).subtract(fee);

		const discrepancy = input.discrepancyAmount
			? Money.fromStorage(input.discrepancyAmount, currency, decimals)
			: await this.computeDiscrepancy(input.sellerId, currency, net);

		if (!discrepancy.isZero() && !input.note) {
			// Recording a difference without a word about it is how a difference becomes permanent.
			throw new BadRequestException('A settlement with a discrepancy needs a note.');
		}

		const settlement = this.typeOrmSellerSettlementRepository.create({
			...input,
			status: input.status ?? SellerSettlementStatus.OPEN,
			currencyDecimals: decimals,
			// The net is derived from the reported figures rather than accepted beside them, so the row
			// cannot state a net its own gross, commission and fee do not produce.
			netAmount: net.toStorageString(),
			discrepancyAmount: discrepancy.toStorageString(),
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as Partial<SellerSettlement>);

		const saved = await this.typeOrmSellerSettlementRepository.save(settlement as SellerSettlement);

		await this.emit(saved, 'seller_settlement.recorded', {
			providerKey: saved.providerKey,
			grossAmount: saved.grossAmount,
			commissionAmount: saved.commissionAmount,
			feeAmount: saved.feeAmount,
			netAmount: saved.netAmount,
			periodStart: saved.periodStart,
			periodEnd: saved.periodEnd,
			discrepancyAmount: saved.discrepancyAmount
		});

		return saved;
	}

	/**
	 * Writes what a settlement states about itself: its period, its report and external references, the
	 * holder it pays and its note and metadata — and nothing its lifecycle owns.
	 *
	 * This is the write behind `PUT /seller-settlements/:id` and `updateSellerSettlement`. The inherited
	 * update writes whatever partial it is handed, and both surfaces used to hand it `status` and the four
	 * figures: a settlement could be set `CLOSED` without the close, `RECONCILED` without the comparison, or
	 * given a net its own figures do not produce. The members in {@link SELLER_SETTLEMENT_LIFECYCLE_MEMBERS}
	 * are refused here, whichever surface or caller names them; the rest of the write — its tenant scoping
	 * included — is the base's.
	 *
	 * @param id The settlement id, or the conditions it must satisfy.
	 * @param partialEntity The fields to change.
	 * @returns The update result, or the updated row, whichever the ORM answers.
	 * @throws BadRequestException when the partial names a member only the settlement's operations write.
	 */
	public async update(
		id: string | FindOptionsWhere<SellerSettlement>,
		partialEntity: QueryDeepPartialEntity<SellerSettlement>
	): Promise<SellerSettlement | UpdateResult> {
		assertNoLifecycleMembers(
			partialEntity,
			SELLER_SETTLEMENT_LIFECYCLE_MEMBERS,
			'SELLER_SETTLEMENT_FIELD_NOT_EDITABLE',
			'a settlement is reconciled, closed and disputed through its own operations, and its figures are the provider report as recorded'
		);

		return super.update(id, partialEntity);
	}

	/**
	 * Marks a settlement reconciled against the platform's lines for the period.
	 *
	 * @returns The settlement and the per-transaction differences the comparison found.
	 */
	async reconcile(
		id: ID,
		report?: { providerReportId?: string; note?: string }
	): Promise<{ settlement: SellerSettlement; differences: Array<{ transactionId: ID; platformNet: string }> }> {
		const settlement = await this.getSettlement(id);

		const rows = await this.platformLines(settlement);
		const decimals = settlement.currencyDecimals;
		const currency = settlement.currency as CurrencyCode;

		const platformNet = Money.sum(
			rows.map((row) => Money.fromStorage(row.netAmount, currency, decimals)),
			currency,
			decimals
		);
		const reportedNet = Money.fromStorage(settlement.netAmount, currency, decimals);
		const discrepancy = platformNet.subtract(reportedNet);

		settlement.status = SellerSettlementStatus.RECONCILED;
		settlement.reconciledAt = new Date();
		settlement.reconciledByUserId = RequestContext.currentUserId();
		settlement.providerReportId = report?.providerReportId ?? settlement.providerReportId;
		settlement.discrepancyAmount = discrepancy.toStorageString();

		if (!discrepancy.isZero()) {
			// A discrepancy is recorded and reported, never repaired: refusing the report would leave the
			// platform with no record of what the provider said.
			settlement.status = SellerSettlementStatus.DISPUTED;
			settlement.note = report?.note ?? settlement.note;
		}

		const saved = await this.typeOrmSellerSettlementRepository.save(settlement);

		return {
			settlement: saved,
			differences: rows.map((row) => ({ transactionId: row.id as ID, platformNet: row.netAmount }))
		};
	}

	/** Closes a settlement. A closed settlement accepts no further lines. */
	async close(id: ID, note?: string): Promise<SellerSettlement> {
		const settlement = await this.getSettlement(id);

		if (settlement.status === SellerSettlementStatus.CLOSED) {
			return settlement;
		}

		settlement.status = SellerSettlementStatus.CLOSED;
		settlement.closedAt = new Date();
		settlement.note = note ?? settlement.note;

		const saved = await this.typeOrmSellerSettlementRepository.save(settlement);

		await this.emit(saved, 'seller_settlement.closed', {
			providerKey: saved.providerKey,
			netAmount: saved.netAmount,
			closedAt: saved.closedAt,
			// The comparison goes through the kernel's exact comparison rather than through `Number`, which
			// is the class docstring's own rule and the one place here that did not follow it: `0.000000`,
			// `0`, `-0.000000` and a column the provider left null are one answer, and no monetary decision
			// in this package is made by parsing a decimal into a double.
			reconciled: compareDecimalStrings(saved.discrepancyAmount ?? '0', '0') === 0
		});

		return saved;
	}

	/** Marks a settlement disputed, which requires a reason. */
	async dispute(id: ID, reason: string): Promise<SellerSettlement> {
		const settlement = await this.getSettlement(id);

		if (!reason) {
			throw new BadRequestException('A disputed settlement needs a reason.');
		}

		if (settlement.status === SellerSettlementStatus.CLOSED) {
			throw new ConflictException('A closed settlement is final.');
		}

		settlement.status = SellerSettlementStatus.DISPUTED;
		settlement.note = reason;

		return this.typeOrmSellerSettlementRepository.save(settlement);
	}

	/**
	 * The platform's own rows for a settlement's period, which the reconciliation compares against.
	 *
	 * The read carries the settlement's own tenant and organization: a ledger read that names only the
	 * seller trusts the foreign key to be unique across the installation, and a leaked cross-organization
	 * seller id would put another organization's rows into this organization's discrepancy figure.
	 */
	private async platformLines(settlement: SellerSettlement): Promise<SellerTransaction[]> {
		const rows = await this.transactionRepository.find({
			where: {
				sellerId: settlement.sellerId,
				currency: settlement.currency,
				tenantId: settlement.tenantId,
				organizationId: settlement.organizationId
			} as FindOptionsWhere<SellerTransaction>,
			order: { occurredAt: 'ASC' } as any
		});

		return rows.filter((row) => {
			if (settlement.settlementCurrency && row.currency !== settlement.settlementCurrency) {
				return false;
			}

			if (settlement.periodStart && new Date(row.occurredAt) < new Date(settlement.periodStart)) {
				return false;
			}

			if (settlement.periodEnd && new Date(row.occurredAt) > new Date(settlement.periodEnd)) {
				return false;
			}

			return true;
		});
	}

	/** The difference between the platform's lines for the period and the reported net. */
	private async computeDiscrepancy(
		sellerId: ID,
		currency: CurrencyCode,
		reportedNet: Money
	): Promise<Money> {
		const rows = await this.transactionRepository.find({
			where: {
				sellerId,
				currency,
				// The discrepancy is a figure about this organization's ledger, so the read is scoped to it
				// rather than to the seller id alone.
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerTransaction>
		});

		const platformNet = Money.sum(
			rows.map((row) => Money.fromStorage(row.netAmount, currency, reportedNet.decimals)),
			currency,
			reportedNet.decimals
		);

		return platformNet.subtract(reportedNet);
	}

	/** Writes one outbox row for a settlement state change. */
	private async emit(settlement: SellerSettlement, name: string, data: Record<string, any>): Promise<void> {
		await this.typeOrmSellerSettlementRepository.manager.transaction(async (manager) => {
			await this.outbox.append(manager, {
				name,
				aggregateType: 'SELLER_SETTLEMENT',
				aggregateId: settlement.id as ID,
				data: { settlementId: settlement.id, sellerId: settlement.sellerId, currency: settlement.currency, ...data },
				tenantId: settlement.tenantId,
				organizationId: settlement.organizationId
			});
		});
	}
}
