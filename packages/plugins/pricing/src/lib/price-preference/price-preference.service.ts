import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { PricePreferenceAttribute } from '../pricing.types';
import { PricePreference } from './price-preference.entity';
import { TypeOrmPricePreferenceRepository } from './repository/type-orm-price-preference.repository';
import { MikroOrmPricePreferenceRepository } from './repository/mikro-orm-price-preference.repository';

/** The scopes a tax-inclusivity question may be asked about. */
export interface ITaxInclusivityQuery {
	/** Currency the price is expressed in. */
	currency?: CurrencyCode;
	/** Region the price is being presented in. */
	regionId?: ID;
	/** Channel code the price is being presented on. */
	channelCode?: string;
}

/**
 * Tax-inclusivity preferences.
 *
 * This service answers one question and reads one table. It is deliberately the *third* answer in
 * the chain — a price row's own `taxInclusive` is first, its price list's is second — so a merchant
 * can say "prices in EUR are shown with tax" once and still override it on a single price that was
 * negotiated tax-exclusive.
 *
 * The precedence inside this service is fixed and matches the schema's resolution order: a currency
 * preference beats a region preference, which beats a channel preference. That order is not
 * arbitrary — a currency is what the customer sees and pays in, a region is where they are, and a
 * channel is how they arrived — and it is the order the resolution algorithm documents.
 */
@Injectable()
export class PricePreferenceService extends TenantAwareCrudService<PricePreference> {
	constructor(
		readonly typeOrmPricePreferenceRepository: TypeOrmPricePreferenceRepository,
		readonly mikroOrmPricePreferenceRepository: MikroOrmPricePreferenceRepository
	) {
		super(typeOrmPricePreferenceRepository, mikroOrmPricePreferenceRepository);
	}

	/**
	 * The tenant and organization every read and write of this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Reads the preference stored for one scope.
	 *
	 * @param attribute The scope kind.
	 * @param value The value inside that scope.
	 * @returns The preference, or null when the scope has none.
	 */
	public async findFor(attribute: PricePreferenceAttribute, value: string): Promise<PricePreference | null> {
		const { tenantId, organizationId } = this.scope;

		if (!organizationId || !value) {
			return null;
		}

		return await this.typeOrmPricePreferenceRepository.findOne({
			where: {
				tenantId,
				organizationId,
				attribute,
				value: this.normalizeValue(attribute, value)
			} as FindOptionsWhere<PricePreference>
		});
	}

	/**
	 * Answers "are prices in this scope presented tax-inclusive?".
	 *
	 * @param query The scopes the question may be asked about. Each one that is absent is simply not
	 * asked about, which is what lets a caller with a currency but no region still get an answer.
	 * @returns The answer, or null when no scope has one — the caller then falls back to its own
	 * default rather than being handed a guess.
	 */
	public async resolveTaxInclusivity(query: ITaxInclusivityQuery): Promise<boolean | null> {
		if (query.currency) {
			const preference = await this.findFor(PricePreferenceAttribute.CURRENCY, query.currency);

			if (preference) {
				return preference.isTaxInclusive;
			}
		}

		if (query.regionId) {
			const preference = await this.findFor(PricePreferenceAttribute.REGION, query.regionId);

			if (preference) {
				return preference.isTaxInclusive;
			}
		}

		if (query.channelCode) {
			const preference = await this.findFor(PricePreferenceAttribute.CHANNEL, query.channelCode);

			if (preference) {
				return preference.isTaxInclusive;
			}
		}

		return null;
	}

	/**
	 * Creates a preference after canonicalising its scope value.
	 *
	 * @param entity The preference to create.
	 * @returns The stored preference.
	 * @throws BadRequestException when the same scope already has an answer, because two answers for
	 * one scope would make a displayed price depend on row order.
	 */
	public async createOne(entity: DeepPartial<PricePreference>): Promise<PricePreference> {
		const attribute = entity.attribute;

		if (!attribute) {
			throw new BadRequestException('PRICE_PREFERENCE_INVALID: attribute is required.');
		}

		const value = this.normalizeValue(attribute, entity.value);
		const existing = await this.findFor(attribute, value);

		if (existing) {
			throw new BadRequestException(
				`PRICE_PREFERENCE_EXISTS: the ${attribute} preference for "${value}" already exists.`
			);
		}

		return await super.create({ ...entity, value });
	}

	/**
	 * Updates a preference. Only the answer is editable; the scope is the row's identity.
	 *
	 * @param id The preference to update.
	 * @param entity The fields to change.
	 * @returns The update result.
	 */
	public async updateOne(
		id: ID,
		entity: QueryDeepPartialEntity<PricePreference>
	): Promise<UpdateResult | PricePreference> {
		// Read first: this both scopes the write to the caller's tenant and organization and refuses
		// an update to a preference the caller cannot see.
		await this.findOneByIdString(id);

		return await super.update(id, entity);
	}

	/**
	 * @param attribute The scope kind.
	 * @param value The raw scope value.
	 * @returns The value as it is stored: a currency code is upper-cased so that `usd` and `USD` are
	 * one scope rather than two, and an identifier or code is trimmed but otherwise left alone.
	 * @throws BadRequestException when the value is missing.
	 */
	private normalizeValue(attribute: PricePreferenceAttribute, value: string): string {
		if (typeof value !== 'string' || value.trim() === '') {
			throw new BadRequestException(`PRICE_PREFERENCE_INVALID: a ${attribute} preference needs a value.`);
		}

		return attribute === PricePreferenceAttribute.CURRENCY ? value.trim().toUpperCase() : value.trim();
	}
}
