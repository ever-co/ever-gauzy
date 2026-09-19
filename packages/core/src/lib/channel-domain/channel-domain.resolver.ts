import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IChannelDomain, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ChannelEventPublisher } from '../channel/channel-event.publisher';
import { ChannelService } from '../channel/channel.service';
import { ChannelDomainService } from './channel-domain.service';
import { IChannelDomainVerification, verifyChannelDomain } from './channel-domain-verification';

/** The members `CreateChannelDomainInput` declares in the schema. */
export interface ICreateChannelDomainInput {
	channelId: Id;
	hostname: string;
	isPrimary?: boolean;
	isSslEnabled?: boolean;
	redirectToPrimary?: boolean;
	metadata?: Record<string, unknown>;
}

/** The members `UpdateChannelDomainInput` declares in the schema. */
export interface IUpdateChannelDomainInput {
	id: Id;
	isPrimary?: boolean;
	isSslEnabled?: boolean;
	redirectToPrimary?: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * The fields a hostname list may be filtered and sorted by, and its default order.
 *
 * `channelId` and `hostname` are also the two members the service narrows in the store; the rest are
 * applied over the rows it returned, so one filter implementation serves the whole input.
 */
const CHANNEL_DOMAIN_FILTERABLE = {
	id: 'ID',
	channelId: 'ID',
	hostname: 'STRING',
	isPrimary: 'BOOLEAN',
	isSslEnabled: 'BOOLEAN',
	redirectToPrimary: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CHANNEL_DOMAIN_SORTABLE = [
	'createdAt',
	'updatedAt',
	'hostname',
	'isPrimary',
	'isSslEnabled',
	'redirectToPrimary'
] as const;

/**
 * The order the delivered list means: the channel's canonical host first. The connection reproduces
 * it rather than replacing it, so REST and GraphQL list the same rows in the same order when neither
 * caller states a sort.
 */
const CHANNEL_DOMAIN_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'isPrimary', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Hostname → channel resolution over GraphQL.
 *
 * It delegates to the same `ChannelDomainService` the `/api/channel-domains` routes call, under the
 * same guard chain and the same permission. Binding a hostname also announces the channel it belongs
 * to, because a hostname is part of the channel aggregate: a client watching `channelChanged` is not
 * asked to watch a pivot as well.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ChannelDomain')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.CHANNELS_VIEW)
export class ChannelDomainResolver {
	constructor(
		private readonly channelDomainService: ChannelDomainService,
		private readonly channelService: ChannelService,
		private readonly channelEventPublisher: ChannelEventPublisher
	) {}

	/**
	 * The hostnames of the caller's organization, the canonical host first.
	 */
	@Query('channelDomains')
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	async channelDomains(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IChannelDomain>> {
		// The delivered service lists one channel's hostnames and takes the channel as an argument, so
		// the organization-wide read the endpoint table describes is composed from the same service's
		// scoped `find` — the same table, the same tenancy, the same rows — and the caller's own
		// `filter` is applied to them by the connection below.
		const rows = await this.channelDomainService.find();

		return buildConnection<IChannelDomain>({
			rows,
			filterable: CHANNEL_DOMAIN_FILTERABLE,
			sortable: CHANNEL_DOMAIN_SORTABLE,
			defaultSort: CHANNEL_DOMAIN_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One hostname of the caller's organization, or `null` when there is none.
	 */
	@Query('channelDomain')
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	async channelDomain(@Args('id', { type: () => ID }) id: Id): Promise<IChannelDomain | null> {
		return this.channelDomainService.findDomain(id);
	}

	/**
	 * Attaches a hostname to a channel.
	 */
	@Mutation('createChannelDomain')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async createChannelDomain(@Args('input') input: ICreateChannelDomainInput): Promise<IChannelDomain> {
		const domain = await this.channelDomainService.bindDomain(input as never);

		await this.announceChannel(domain.channelId, 'domain-bound');

		return domain;
	}

	/**
	 * Changes the flags of a hostname that exists.
	 */
	@Mutation('updateChannelDomain')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async updateChannelDomain(@Args('input') input: IUpdateChannelDomainInput): Promise<IChannelDomain> {
		const domain = await this.channelDomainService.updateDomain(input.id, input as never);

		await this.announceChannel(domain.channelId, 'domain-updated');

		return domain;
	}

	/**
	 * Detaches a hostname from its channel.
	 */
	@Mutation('deleteChannelDomain')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async deleteChannelDomain(
		@Args('id', { type: () => ID }) id: Id,
		@Args('force', { type: () => Boolean, nullable: true }) force?: boolean
	): Promise<IChannelDomain> {
		const domain = await this.channelDomainService.unbindDomain(id, { force });

		await this.announceChannel(domain.channelId, 'domain-unbound');

		return domain;
	}

	/**
	 * Answers whether a hostname reaches the channel it is bound to.
	 */
	@Mutation('verifyChannelDomain')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async verifyChannelDomain(@Args('id', { type: () => ID }) id: Id): Promise<IChannelDomainVerification> {
		return verifyChannelDomain(this.channelDomainService, await this.channelDomainService.findDomainOrFail(id));
	}

	/**
	 * Announces the channel a hostname change belongs to.
	 *
	 * @param channelId The channel the hostname resolves to.
	 * @param action The action that produced the change.
	 */
	private async announceChannel(channelId: Id, action: string): Promise<void> {
		await this.channelEventPublisher.channelChanged(await this.channelService.findChannelOrFail(channelId), action);
	}
}
