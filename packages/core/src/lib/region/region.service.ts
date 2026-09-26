import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ChannelRegionRefusalReason,
	ChannelStatus,
	CurrencyCode,
	ID,
	IRegion,
	IRegionCreateInput,
	IRegionFindInput,
	IRegionUpdateInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { CurrencyService } from '../currency/currency.service';
import { Region } from './region.entity';
import { TypeOrmRegionRepository } from './repository/type-orm-region.repository';
import { MikroOrmRegionRepository } from './repository/mikro-orm-region.repository';

/**
 * The commercial geography, and the two rules a geography cannot be written without.
 *
 * **1. A region prices in a currency the platform knows.** `currency` names a row of the currency
 * master, and the check is made here, at write time, rather than at the first checkout — the schema
 * chapter states it as the invariant I-26 and assigns it to this service. A currency the master does
 * not carry has no decimal places, no rounding mode and no tender flag, so a region naming one could
 * not price a cart at all and the failure would surface in a place that cannot explain it.
 *
 * **2. At most one default region per organization.** The partial unique index makes two live defaults
 * impossible; what an index cannot do is *move* the flag, so the operation that claims it releases the
 * previous holder in the same transaction. Both writes are decided from rows the transaction holds, so
 * two concurrent claims cannot both see an unclaimed flag and both take it.
 *
 * The region's status shares the channel's vocabulary — `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`, with
 * `ARCHIVED` terminal — so one filter and one navigation cover both kinds of row. A region is archived
 * rather than deleted because a cart, a tax rate and a price list may all name it and an archived row
 * still resolves for the documents that carry it.
 *
 * The country set is deliberately **not** this service's: membership lives on {@link RegionCountryService},
 * because each membership carries a tax-exemption flag and an optional province scope that belong to the
 * pair and not to the region.
 *
 * **Removal.** The supported path is `ARCHIVED` followed by a soft delete, and the soft delete is offered
 * because a region nothing references is an ordinary administrative mistake. A region that is still named
 * by a channel's default, a tax rate or a price list is protected by the constraints those tables carry,
 * so a hard delete fails at the database rather than silently orphaning them.
 */
@Injectable()
export class RegionService extends TenantAwareCrudService<Region> {
	/**
	 * The lifecycle the region moves along.
	 *
	 * `DRAFT → ACTIVE | INACTIVE | ARCHIVED`, `ACTIVE ↔ INACTIVE`, and `ARCHIVED` terminal. The graph is
	 * stated once so that a status a caller cannot reach is refused rather than written: a region that
	 * came back from `ARCHIVED` would be a region whose retirement the documents naming it never saw.
	 */
	private static readonly TRANSITIONS: Record<ChannelStatus, ChannelStatus[]> = {
		[ChannelStatus.DRAFT]: [ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.ARCHIVED],
		[ChannelStatus.ACTIVE]: [ChannelStatus.INACTIVE, ChannelStatus.ARCHIVED],
		[ChannelStatus.INACTIVE]: [ChannelStatus.ACTIVE, ChannelStatus.ARCHIVED],
		[ChannelStatus.ARCHIVED]: []
	};

	constructor(
		readonly typeOrmRegionRepository: TypeOrmRegionRepository,
		readonly mikroOrmRegionRepository: MikroOrmRegionRepository,
		/**
		 * The currency master, for the one check the invariant I-26 states. The dependency runs one way:
		 * the currency master knows nothing about regions.
		 */
		private readonly currencyService: CurrencyService
	) {
		super(typeOrmRegionRepository, mikroOrmRegionRepository);
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
	 * Opens a commercial geography.
	 *
	 * The currency is checked against the master before the row is written, because the rule is about the
	 * value that ends up stored and not about the moment it arrived. The region starts in the status the
	 * column states — `ACTIVE`, the schema's own default for this column — and it carries no countries:
	 * membership is a pivot written by the operation that owns the country set, so a region is never
	 * created with a set nobody can see the flags of.
	 *
	 * @param input The region as the caller states it.
	 * @returns The stored region.
	 * @throws BadRequestException when the name, the code or the currency is absent, when the currency is
	 * not one the platform knows, or when the code is already taken inside the organization.
	 */
	async createRegion(input: IRegionCreateInput): Promise<IRegion> {
		const name = input?.name ? String(input.name).trim() : '';
		const code = input?.code ? String(input.code).trim() : '';

		if (!name) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a region is stated with a name, and none was presented.`
			);
		}

		if (!code) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a region is stated with a code, and none was presented; the code is what a stored reference names.`
			);
		}

		const currency = await this.assertKnownCurrency(input?.currency);

		const taken = await this.findByCode(code);

		if (taken) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: a region with code '${code}' already exists in this organization.`
			);
		}

		return this.create({
			...input,
			name,
			code,
			currency,
			// Stated rather than left to the column's own default, so that a row written through a path
			// that ignores defaults still lands in the state the schema names for a new region — and so
			// that a region is never the organization's default merely because nobody said otherwise.
			status: ChannelStatus.ACTIVE,
			isDefault: false,
			...this.scope
		} as never);
	}

	/**
	 * Lists the regions of the caller's organization.
	 *
	 * @param filter Optional narrowing by status, code, currency or default flag.
	 * @returns The regions, newest first.
	 */
	async listRegions(filter: IRegionFindInput = {}): Promise<IRegion[]> {
		return this.find({
			where: {
				...(filter.status ? { status: filter.status } : {}),
				...(filter.code ? { code: filter.code } : {}),
				...(filter.currency ? { currency: filter.currency } : {}),
				...(filter.isDefault !== undefined ? { isDefault: filter.isDefault } : {}),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);
	}

	/**
	 * Reads one region of the caller's organization, answering null when there is none.
	 *
	 * The answering form exists because a caller deciding what to do about a missing region — a checkout
	 * resolving a geography from an address, an import reconciling a mapping — treats the miss as an
	 * ordinary fact, while {@link findRegionOrFail} is for a caller handed an identifier it must honour.
	 *
	 * @param id The region id.
	 * @returns The region, or null.
	 */
	async findRegion(id: ID): Promise<IRegion | null> {
		const regions: Region[] = await this.find({ where: { id, ...this.scope } } as never);

		return regions.length ? regions[0] : null;
	}

	/**
	 * Loads a region that belongs to the caller's organization.
	 *
	 * @param id The region id.
	 * @returns The region.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findRegionOrFail(id: ID): Promise<IRegion> {
		const region = await this.findRegion(id);

		if (!region) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${ChannelRegionRefusalReason.REGION_NOT_FOUND} — region '${String(
					id
				)}' could not be found.`
			);
		}

		return region;
	}

	/**
	 * The organization's default region, when it has one.
	 *
	 * @returns The default region, or null.
	 */
	async findDefaultRegion(): Promise<IRegion | null> {
		const regions: Region[] = await this.find({ where: { isDefault: true, ...this.scope } } as never);

		return regions.length ? regions[0] : null;
	}

	/**
	 * Changes the descriptive facts of a region.
	 *
	 * A currency change is re-checked exactly like the creation is: the rule is about the stored value,
	 * and a region moved onto a currency the master does not carry would price its carts by guesswork
	 * from the moment of the change. `isDefault` and `status` are absent by construction — each has an
	 * operation of its own, and a descriptive update that could also move one of them is how a lifecycle
	 * stops being one.
	 *
	 * @param id The region to change.
	 * @param input The facts to change.
	 * @returns The stored region.
	 * @throws BadRequestException when a new code is already taken or the currency is unknown.
	 * @throws NotFoundException when the region is not in the caller's scope.
	 */
	async updateRegion(id: ID, input: IRegionUpdateInput): Promise<IRegion> {
		const region = await this.findRegionOrFail(id);
		const currency = input?.currency !== undefined ? await this.assertKnownCurrency(input.currency) : undefined;
		const code = input?.code !== undefined ? String(input.code).trim() : undefined;

		if (code && code !== region.code) {
			const taken = await this.findByCode(code, region.id);

			if (taken) {
				throw new BadRequestException(
					`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: a region with code '${code}' already exists in this organization.`
				);
			}
		}

		await this.update(id, {
			...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
			...(code !== undefined ? { code } : {}),
			...(currency !== undefined ? { currency } : {}),
			...(input.isTaxInclusive !== undefined ? { isTaxInclusive: input.isTaxInclusive } : {}),
			...(input.taxProviderKey !== undefined ? { taxProviderKey: input.taxProviderKey } : {}),
			...(input.paymentProviderKeys !== undefined ? { paymentProviderKeys: input.paymentProviderKeys } : {}),
			...(input.fulfillmentProviderKeys !== undefined
				? { fulfillmentProviderKeys: input.fulfillmentProviderKeys }
				: {}),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findRegionOrFail(id);
	}

	/**
	 * Moves the region along its lifecycle, and nowhere else.
	 *
	 * @param id The region to move.
	 * @param next The status to move it to.
	 * @returns The stored region.
	 * @throws BadRequestException when the status is not one a region can hold, or the graph does not
	 * contain the move.
	 * @throws NotFoundException when the region is not in the caller's scope.
	 */
	async setRegionStatus(id: ID, next: ChannelStatus): Promise<IRegion> {
		if (!next || !Object.values(ChannelStatus).includes(next)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_INVALID_ENUM}: '${String(next)}' is not a status a region can hold.`
			);
		}

		const region = await this.findRegionOrFail(id);

		if (!RegionService.TRANSITIONS[region.status]?.includes(next)) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${ChannelRegionRefusalReason.REGION_STATUS_INVALID} — a region moves from ${region.status} to ${
					RegionService.TRANSITIONS[region.status]?.join(', ') || 'nothing'
				}, and ${next} is not one of them.`
			);
		}

		await this.update(id, { status: next } as never);

		return this.findRegionOrFail(id);
	}

	/**
	 * Claims the organization's default region, releasing the flag from the previous holder.
	 *
	 * Both writes happen inside one transaction, against rows the transaction holds, so two concurrent
	 * claims cannot both read an unclaimed flag and both take it — which is the state the partial unique
	 * index would then reject at commit time, after both callers had been told they had it.
	 *
	 * @param id The region to make the default.
	 * @returns The stored region.
	 * @throws NotFoundException when the region is not in the caller's scope.
	 */
	async setDefaultRegion(id: ID): Promise<IRegion> {
		const saved = await this.typeOrmRegionRepository.manager.transaction(async (manager) => {
			const region = await this.lockRegion(manager, id);

			if (!region) {
				throw new NotFoundException(
					`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${ChannelRegionRefusalReason.REGION_NOT_FOUND} — region '${String(
						id
					)}' could not be found.`
				);
			}

			const current: Region[] = await manager.find(Region, {
				where: { isDefault: true, ...this.scope }
			} as never);

			for (const other of current) {
				if (other.id !== region.id && !other.deletedAt) {
					other.isDefault = false;
					await manager.save(Region, other);
				}
			}

			region.isDefault = true;

			return manager.save(Region, region);
		});

		return this.findRegionOrFail(saved.id);
	}

	/**
	 * Retires a region without deleting it.
	 *
	 * Idempotent: archiving a region that is already archived answers with the row the first archive
	 * wrote and changes nothing, because a retried archive is ordinary client behaviour. The row stays,
	 * because a cart, a tax rate and a price list may all name it and a document that points at a
	 * missing region is unauditable.
	 *
	 * @param id The region to retire.
	 * @returns The stored region, `ARCHIVED`.
	 * @throws NotFoundException when the region is not in the caller's scope.
	 */
	async archiveRegion(id: ID): Promise<IRegion> {
		const region = await this.findRegionOrFail(id);

		if (region.status === ChannelStatus.ARCHIVED) {
			return region;
		}

		await this.update(id, { status: ChannelStatus.ARCHIVED, isArchived: true, archivedAt: new Date() } as never);

		return this.findRegionOrFail(id);
	}

	/**
	 * Refuses a currency the platform does not know, and answers the normalised code when it does.
	 *
	 * The check reads the currency master through its own service rather than through a second copy of
	 * the rule, so "which currencies exist" has one answer for the whole product. The code is upper-cased
	 * before it is compared and before it is returned, because the master stores ISO codes in upper case
	 * and a region written as `usd` would silently match nothing.
	 *
	 * @param currency The currency code the caller stated.
	 * @returns The normalised currency code.
	 * @throws BadRequestException when no code was stated, or when the master holds none.
	 */
	async assertKnownCurrency(currency?: CurrencyCode | null): Promise<CurrencyCode> {
		const code = currency ? String(currency).trim().toUpperCase() : '';

		if (!code) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a region is stated with a currency, and none was presented.`
			);
		}

		const known = await this.currencyService.find({ where: { isoCode: code } } as never);

		if (!known?.length) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: ${ChannelRegionRefusalReason.REGION_CURRENCY_UNKNOWN} — '${code}' is not a currency this platform knows, and a region that prices in one would produce totals no rounding rule covers.`
			);
		}

		return code;
	}

	/**
	 * Finds the organization's region under one code.
	 *
	 * @param code The region code.
	 * @param exceptId A region to exclude from the probe, when one row is being edited.
	 * @returns The region already holding the code, or null.
	 */
	private async findByCode(code: string, exceptId?: ID): Promise<Region | null> {
		const regions: Region[] = await this.find({ where: { code, ...this.scope } } as never);
		const other = (regions ?? []).filter((row) => row.id !== exceptId);

		return other.length ? other[0] : null;
	}

	/**
	 * Reads the region under a lock where the dialect supports one.
	 *
	 * The default rule is decided from the flag's current holder, so the row is held for the decision
	 * rather than read and written around. The embedded dialect serializes writers on its own, so there
	 * the surrounding transaction is the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param id The region to lock.
	 * @returns The locked region, or null when it does not exist.
	 */
	private async lockRegion(manager: EntityManager, id: ID): Promise<Region | null> {
		const query = manager.createQueryBuilder(Region, 'region').where({ id, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}
}
