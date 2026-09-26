import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IRegion, IRegionCountry, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context/request-context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { CHANNEL_EVENT_NAMES, ChannelEventPublisher, IRegionChangedEnvelope } from '../channel/channel-event.publisher';
import { RegionService } from './region.service';
import { RegionCountryService } from '../region-country/region-country.service';

/** The members `CreateRegionInput` declares in the schema. */
export interface ICreateRegionInput {
	organizationId: Id;
	name: string;
	code: string;
	currency: string;
	isTaxInclusive?: boolean;
	taxProviderKey?: string;
	paymentProviderKeys?: string[];
	fulfillmentProviderKeys?: string[];
	metadata?: Record<string, unknown>;
}

/** The members `UpdateRegionInput` declares in the schema. */
export interface IUpdateRegionInput extends Partial<Omit<ICreateRegionInput, 'organizationId'>> {
	id: Id;
}

/** The members `ReplaceRegionCountriesInput` declares in the schema. */
export interface IReplaceRegionCountriesInput {
	id: Id;
	countries: { countryId: Id; isTaxExempt?: boolean; provinceCodes?: string[] }[];
}

/**
 * The fields a region list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 */
const REGION_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	currency: 'STRING',
	status: 'ENUM',
	isDefault: 'BOOLEAN',
	taxProviderKey: 'STRING',
	isTaxInclusive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const REGION_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code', 'currency', 'status', 'isDefault'] as const;

/**
 * The order the delivered list method means: newest first. The connection reproduces it rather than
 * replacing it, so REST and GraphQL list the same rows in the same order when neither states a sort.
 */
const REGION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The commercial geography over GraphQL.
 *
 * It delegates to the same `RegionService` and `RegionCountryService` the `/api/regions` routes call,
 * under the same guard chain and the same permission. The two set operations are mutations here for
 * the same reason they are `PUT` routes there: a region's country set is saved as a set, so a client
 * cannot leave it half-applied by choosing a protocol.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Region')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.REGIONS_VIEW)
export class RegionResolver {
	constructor(
		private readonly regionService: RegionService,
		private readonly regionCountryService: RegionCountryService,
		private readonly channelEventPublisher: ChannelEventPublisher,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * The regions of the caller's organization, newest first.
	 */
	@Query('regions')
	@Permissions(PermissionsEnum.REGIONS_VIEW)
	async regions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IRegion>> {
		const rows = await this.regionService.listRegions();

		return buildConnection<IRegion>({
			rows,
			filterable: REGION_FILTERABLE,
			sortable: REGION_SORTABLE,
			defaultSort: REGION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One region of the caller's organization, or `null` when there is none.
	 */
	@Query('region')
	@Permissions(PermissionsEnum.REGIONS_VIEW)
	async region(@Args('id', { type: () => ID }) id: Id): Promise<IRegion | null> {
		return this.regionService.findRegion(id);
	}

	/**
	 * Opens a commercial geography.
	 */
	@Mutation('createRegion')
	@Permissions(PermissionsEnum.REGIONS_CREATE)
	async createRegion(@Args('input') input: ICreateRegionInput): Promise<IRegion> {
		const region = await this.regionService.createRegion(input as never);

		await this.channelEventPublisher.regionChanged(region, 'created');

		return region;
	}

	/**
	 * Changes the descriptive facts of a region.
	 */
	@Mutation('updateRegion')
	@Permissions(PermissionsEnum.REGIONS_EDIT)
	async updateRegion(@Args('input') input: IUpdateRegionInput): Promise<IRegion> {
		const region = await this.regionService.updateRegion(input.id, input as never);

		await this.channelEventPublisher.regionChanged(region, 'updated');

		return region;
	}

	/**
	 * Retires a region.
	 */
	@Mutation('deleteRegion')
	@Permissions(PermissionsEnum.REGIONS_DELETE)
	async deleteRegion(@Args('id', { type: () => ID }) id: Id): Promise<IRegion> {
		const region = await this.regionService.archiveRegion(id);

		await this.channelEventPublisher.regionChanged(region, 'archived');

		return region;
	}

	/**
	 * Claims the organization's default region, releasing the flag from the previous holder.
	 */
	@Mutation('setDefaultRegion')
	@Permissions(PermissionsEnum.REGIONS_EDIT)
	async setDefaultRegion(@Args('id', { type: () => ID }) id: Id): Promise<IRegion> {
		const region = await this.regionService.setDefaultRegion(id);

		await this.channelEventPublisher.regionChanged(region, 'default-changed');

		return region;
	}

	/**
	 * Replaces the served-country set.
	 */
	@Mutation('replaceRegionCountries')
	@Permissions(PermissionsEnum.REGIONS_EDIT)
	async replaceRegionCountries(@Args('input') input: IReplaceRegionCountriesInput): Promise<IRegionCountry[]> {
		const stored = await this.regionCountryService.replaceCountries(
			input.id,
			(input.countries ?? []).map((member) => ({
				countryId: member.countryId,
				isTaxExempt: member.isTaxExempt,
				provinceCodes: member.provinceCodes
			}))
		);

		// The region's own aggregate changed with its country set, so the fact announced is the
		// region's: a subscriber watching regions is not asked to watch a pivot as well.
		await this.channelEventPublisher.regionChanged(
			await this.regionService.findRegionOrFail(input.id),
			'countries-replaced'
		);

		return stored;
	}

	/**
	 * Streams every change to a region of the caller's tenant.
	 *
	 * The topic is `<eventName>:<tenantId>`, so a subscription cannot receive another tenant's event
	 * even if the filter below were wrong; the filter is the second line, and it is where the two
	 * narrowing arguments are applied. Without a resolved tenant nothing is subscribed to, because
	 * the topic of an unauthenticated connection is one no fact is ever published on.
	 */
	@Subscription('regionChanged', {
		filter: (payload: IRegionChangedEnvelope, variables: { regionId?: Id; action?: string }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.regionId || String(payload.region?.id) === String(variables.regionId)) &&
			(!variables?.action || payload.action === variables.action),
		resolve: (payload: IRegionChangedEnvelope) => payload.region
	})
	@Permissions(PermissionsEnum.REGIONS_VIEW)
	regionChanged(
		@Args('regionId', { type: () => ID, nullable: true }) regionId?: Id,
		@Args('action', { type: () => String, nullable: true }) action?: string
	): AsyncIterable<IRegionChangedEnvelope> {
		return this.pubSub.asyncIterableIterator<IRegionChangedEnvelope>(
			this.pubSub.topicFor(CHANNEL_EVENT_NAMES.REGION_CHANGED, String(RequestContext.currentTenantId() ?? ''))
		);
	}
}
