import { BadRequestException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
	AdjustmentOwnerType,
	AdjustmentType,
	CurrencyCode,
	DecimalString,
	IAdjustmentCreateInput,
	IAdjustmentReasonCreateInput,
	IAdjustmentTotal,
	ID
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { Money } from '../money/money';
import { formatDecimalUnits } from '../money/decimal';
import { Adjustment } from './adjustment.entity';
import { AdjustmentReason } from './adjustment-reason.entity';
import { TypeOrmAdjustmentRepository } from './repository/type-orm-adjustment.repository';
import { MikroOrmAdjustmentRepository } from './repository/mikro-orm-adjustment.repository';
import { TypeOrmAdjustmentReasonRepository } from './repository/type-orm-adjustment-reason.repository';
import { MikroOrmAdjustmentReasonRepository } from './repository/mikro-orm-adjustment-reason.repository';

/**
 * The sign each adjustment type carries, where the type fixes it.
 *
 * `MANUAL`, `GIFT_CARD` and `ROUNDING` are absent on purpose: a manual goodwill credit and a manual
 * fee are the same mechanism with opposite signs, a gift-card refund reverses a redemption, and a
 * rounding correction legitimately goes either way.
 */
const REQUIRED_SIGN: Partial<Record<AdjustmentType, 'negative' | 'positive'>> = {
	[AdjustmentType.PROMOTION]: 'negative',
	[AdjustmentType.SHIPPING_DISCOUNT]: 'negative',
	[AdjustmentType.LOYALTY]: 'negative',
	[AdjustmentType.CREDIT]: 'negative',
	[AdjustmentType.FEE]: 'positive'
};

/** The types whose rows a human entered, and which therefore carry a description and a reason. */
const GOVERNED_TYPES: readonly AdjustmentType[] = [AdjustmentType.MANUAL, AdjustmentType.FEE];

/**
 * Writes and reads the platform's money-adjustment ledger.
 *
 * The service owns three rules that no caller should have to remember: an adjustment is never zero
 * (a zero row is noise that every later sum has to carry), its sign agrees with its type, and a manual
 * movement cites a governed reason code. Everything else — which adjustment applies first, how a
 * discount is allocated across lines — belongs to the domain that produces the adjustments.
 */
@Injectable()
export class AdjustmentService extends CrudService<Adjustment> {
	constructor(
		readonly typeOrmAdjustmentRepository: TypeOrmAdjustmentRepository,
		readonly mikroOrmAdjustmentRepository: MikroOrmAdjustmentRepository,
		readonly typeOrmAdjustmentReasonRepository: TypeOrmAdjustmentReasonRepository,
		readonly mikroOrmAdjustmentReasonRepository: MikroOrmAdjustmentReasonRepository
	) {
		super(typeOrmAdjustmentRepository, mikroOrmAdjustmentRepository);
	}

	/**
	 * Appends one adjustment to the ledger.
	 *
	 * Append-only by design: a correction is a new reversing row, so the ledger keeps what was decided
	 * and when, which is what an audit asks for.
	 *
	 * @param input The adjustment to write.
	 * @returns The stored row.
	 * @throws BadRequestException when the amount is not an exact decimal, is zero, carries the wrong
	 * sign for its type, or when a manual adjustment omits its description or cites an unknown reason.
	 */
	async append(input: IAdjustmentCreateInput): Promise<Adjustment> {
		if (!input?.ownerId) {
			throw new BadRequestException('ADJUSTMENT_OWNER_REQUIRED: an adjustment must name the row it belongs to.');
		}

		if (!input.type) {
			throw new BadRequestException('ADJUSTMENT_TYPE_REQUIRED: an adjustment must state what produced it.');
		}

		const money = this.readMoney(input.amount, input.currency);

		if (money.isZero()) {
			throw new BadRequestException(
				'ADJUSTMENT_AMOUNT_ZERO: a zero adjustment is not stored; remove the adjustment instead of zeroing it.'
			);
		}

		const requiredSign = REQUIRED_SIGN[input.type];

		if (requiredSign === 'negative' && !money.isNegative()) {
			throw new BadRequestException(
				`ADJUSTMENT_SIGN_MISMATCH: a ${input.type} adjustment reduces the amount payable and must be negative.`
			);
		}

		if (requiredSign === 'positive' && !money.isPositive()) {
			throw new BadRequestException(
				`ADJUSTMENT_SIGN_MISMATCH: a ${input.type} adjustment increases the amount payable and must be positive.`
			);
		}

		const description = input.description?.trim();
		const reasonCode = input.reasonCode ? input.reasonCode.trim().toUpperCase() : undefined;

		if (GOVERNED_TYPES.includes(input.type)) {
			// Money moving without a document behind it has to be attributable: to a reason an
			// administrator maintains and to a description a customer can read on their order.
			if (!description || description.length < 3) {
				throw new BadRequestException(
					`ADJUSTMENT_DESCRIPTION_REQUIRED: a ${input.type} adjustment needs a description of at least 3 characters.`
				);
			}

			if (!reasonCode) {
				throw new BadRequestException(
					`ADJUSTMENT_REASON_REQUIRED: a ${input.type} adjustment must cite a reason code.`
				);
			}
		}

		if (reasonCode) {
			const reason = await this.resolveReason(reasonCode, input.type);

			// The flag travels with the row so that an approval workflow can find the movements that were
			// supposed to wait for one without re-reading the reason table.
			if (reason.requiresApproval) {
				input = { ...input, metadata: { ...(input.metadata ?? {}), requiresApproval: true } };
			}
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const created = this.typeOrmAdjustmentRepository.create({
			...input,
			amount: money.amount,
			currency: money.currency,
			isTaxInclusive: input.isTaxInclusive ?? false,
			description,
			reasonCode,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		} as Partial<Adjustment>);

		return this.typeOrmAdjustmentRepository.save(created);
	}

	/**
	 * Reads the adjustments of one owner, in the order the ledger applies them.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @returns The rows, oldest first.
	 */
	async findByOwner(ownerType: AdjustmentOwnerType, ownerId: ID): Promise<Adjustment[]> {
		return this.typeOrmAdjustmentRepository.find({
			where: { ownerType, ownerId, ...this.scopeWhere() } as any,
			order: { createdAt: 'ASC', id: 'ASC' } as any
		});
	}

	/**
	 * Sums the adjustments of one owner.
	 *
	 * The sum is exact: the amounts are read as decimals and added as decimals, so the total of a
	 * ledger of scale-6 rows needs no rounding and reconciles with the owner's discount total by
	 * construction.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @param currency The currency the owner is expressed in; used for an owner with no adjustments,
	 * whose total is zero in the owner's currency.
	 * @returns The total, its currency and the number of rows summed.
	 * @throws BadRequestException when the rows do not all carry one currency, which would mean the
	 * ledger itself is wrong.
	 */
	async totalForOwner(
		ownerType: AdjustmentOwnerType,
		ownerId: ID,
		currency?: CurrencyCode
	): Promise<IAdjustmentTotal> {
		const rows = await this.findByOwner(ownerType, ownerId);

		if (rows.length === 0) {
			return {
				ownerType,
				ownerId,
				currency: currency ?? '',
				total: formatDecimalUnits(0n, Money.STORAGE_SCALE),
				count: 0
			};
		}

		const ledgerCurrency = rows[0].currency;
		const amounts = rows.map((row) => {
			if (row.currency !== ledgerCurrency) {
				throw new BadRequestException(
					`CURRENCY_MISMATCH: the adjustments of one owner must share one currency; ` +
						`found ${ledgerCurrency} and ${row.currency}.`
				);
			}

			return Money.fromStorage(row.amount, ledgerCurrency);
		});

		return {
			ownerType,
			ownerId,
			currency: ledgerCurrency,
			total: Money.sum(amounts, ledgerCurrency).toStorageString(),
			count: rows.length
		};
	}

	/**
	 * Resolves a reason code against the governed reason table.
	 *
	 * @param code The code to resolve.
	 * @param type The adjustment type that cites it.
	 * @returns The reason row.
	 * @throws BadRequestException when the code is unknown, deactivated, or does not apply to the type.
	 */
	async resolveReason(code: string, type: AdjustmentType): Promise<AdjustmentReason> {
		const normalized = (code ?? '').trim().toUpperCase();

		if (!normalized) {
			throw new BadRequestException('ADJUSTMENT_REASON_REQUIRED: a reason code is required.');
		}

		const reason = await this.typeOrmAdjustmentReasonRepository.findOne({
			where: { code: normalized, ...this.scopeWhere() } as any
		});

		if (!reason) {
			throw new BadRequestException(
				`ADJUSTMENT_REASON_UNKNOWN: no adjustment reason is configured for "${normalized}".`
			);
		}

		if (reason.isActive === false) {
			throw new BadRequestException(`ADJUSTMENT_REASON_INACTIVE: the reason "${normalized}" is deactivated.`);
		}

		if (reason.appliesTo !== AdjustmentType.MANUAL && reason.appliesTo !== type) {
			throw new BadRequestException(
				`ADJUSTMENT_REASON_NOT_APPLICABLE: the reason "${normalized}" applies to ${reason.appliesTo}, not to ${type}.`
			);
		}

		return reason;
	}

	/**
	 * Lists the reasons an adjustment of a type may cite.
	 *
	 * @param appliesTo The adjustment type, when the caller knows it. The reasons that apply to any
	 * type are always included.
	 * @returns The reasons, in display order.
	 */
	async listReasons(appliesTo?: AdjustmentType): Promise<AdjustmentReason[]> {
		return this.typeOrmAdjustmentReasonRepository.find({
			where: {
				...this.scopeWhere(),
				...(appliesTo ? { appliesTo: In([appliesTo, AdjustmentType.MANUAL]) } : {})
			} as any,
			order: { sortOrder: 'ASC', label: 'ASC' } as any
		});
	}

	/**
	 * Creates a reason when it does not exist and returns it.
	 *
	 * Idempotent because it is what a seed run calls on every boot: seeding must not fail the second
	 * time, and it must not overwrite a label an administrator has since edited.
	 *
	 * @param input The reason to ensure.
	 * @returns The existing or newly created reason.
	 */
	async ensureReason(input: IAdjustmentReasonCreateInput): Promise<AdjustmentReason> {
		const code = (input.code ?? '').trim().toUpperCase();

		if (!code) {
			throw new BadRequestException('ADJUSTMENT_REASON_REQUIRED: a reason code is required.');
		}

		const existing = await this.typeOrmAdjustmentReasonRepository.findOne({
			where: { code, ...this.scopeWhere() } as any
		});

		if (existing) {
			return existing;
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const created = this.typeOrmAdjustmentReasonRepository.create({
			...input,
			code,
			appliesTo: input.appliesTo ?? AdjustmentType.MANUAL,
			requiresApproval: input.requiresApproval ?? false,
			isSystem: input.isSystem ?? true,
			sortOrder: input.sortOrder ?? 0,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		} as Partial<AdjustmentReason>);

		return this.typeOrmAdjustmentReasonRepository.save(created);
	}

	/**
	 * Reads an amount as a monetary value.
	 *
	 * @param amount The amount as supplied.
	 * @param currency The currency it is expressed in.
	 * @returns The value.
	 * @throws BadRequestException carrying the money layer's own code, so a client sees
	 * `MONEY_NOT_DECIMAL_STRING` rather than a generic failure.
	 */
	private readMoney(amount: DecimalString, currency: CurrencyCode): Money {
		try {
			return Money.of(amount, currency);
		} catch (error) {
			throw new BadRequestException((error as Error).message);
		}
	}

	/**
	 * @returns The tenant and organization a read or write is scoped to, omitting what the request
	 * does not carry so that an unscoped caller is not silently restricted to rows belonging to nobody.
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
