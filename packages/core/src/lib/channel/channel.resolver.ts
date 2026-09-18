import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { ChannelStatus, IChannel, IChannelRegion, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context/request-context';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { ChannelService } from './channel.service';
import { ChannelRegionService } from '../channel-region/channel-region.service';
import { CHANNEL_EVENT_NAMES, ChannelEventPublisher, IChannelChangedEnvelope } from './channel-event.publisher';

/**
 * The members `CreateChannelInput` declares in the schema.
 */
export interface ICreateChannelInput {
	organizationId: Id;
	name: string;
	code: string;
	description?: string;
	defaultCurrency?: string;
	defaultLocale?: string;
	orderNumberPrefix?: string;
	orderNumberPadding?: number;
	settings?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

/**
 * The members `UpdateChannelInput` declares in the schema.
 */
export interface IUpdateChannelInput extends Partial<Omit<ICreateChannelInput, 'code'>> {
	id: Id;
}

/** The members `SetChannelStatusInput` declares in the schema. */
export interface ISetChannelStatusInput {
	id: Id;
	status: ChannelStatus;
}

/** The members `ReplaceChannelRegionsInput` declares in the schema. */
export interface IReplaceChannelRegionsInput {
	id: Id;
	items: { regionId: Id; isDefault?: boolean }[];
}

/**
 * The fields a channel list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ChannelFilter` and `ChannelSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 */
const CHANNEL_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	status: 'ENUM',
	isDefault: 'BOOLEAN',
	defaultCurrency: 'STRING',
	defaultLocale: 'STRING',
	defaultRegionId: 'ID',
	orderNumberPrefix: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CHANNEL_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code', 'status', 'isDefault'] as const;

/**
 * The order the delivered list method means: the organization's default channel first, then newest
 * first. The connection reproduces it rather than replacing it, so the REST answer and this one list
 * the same rows in the same order when neither caller states a sort.
 */
const CHANNEL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'isDefault', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The sales context over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ChannelService` the `/api/channels` routes call, under
 * the same guard chain and the same permission. A client that reaches a capability over one protocol
 * is not given a narrower or a wider one than the client that reaches it over the other.
 *
 * **The list root field is a connection, not a bare array.** The same `filter`, `sort` and page the
 * REST route accepts, answered with the platform's own cursor codec, so a cursor obtained over REST
 * resumes here — and the same refusal codes, so a client that branches on `QUERY_SORT_NOT_ALLOWED`
 * over one surface branches on it over the other.
 *
 * **`withDeleted` is deliberately absent.** §7.2 of the GraphQL specification lists it among the
 * connection arguments, and the delivered list methods read live rows only — a repository option
 * they do not expose and this delivery may not add. Offering an argument that cannot be honoured
 * would be the one thing worse than not offering it.
 */
@Resolver('Channel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CHANNELS_VIEW)
export class ChannelResolver {
	constructor(
		private readonly channelService: ChannelService,
		private readonly channelRegionService: ChannelRegionService,
		private readonly channelEventPublisher: ChannelEventPublisher,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * The channels of the caller's organization, the default one first.
	 */
	@Query('channels')
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	async channels(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IChannel>> {
		const rows = await this.channelService.listChannels();

		return buildConnection<IChannel>({
			rows,
			filterable: CHANNEL_FILTERABLE,
			sortable: CHANNEL_SORTABLE,
			defaultSort: CHANNEL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One channel of the caller's organization, or `null` when there is none.
	 */
	@Query('channel')
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	async channel(@Args('id', { type: () => ID }) id: Id): Promise<IChannel | null> {
		return this.channelService.findChannel(id);
	}

	/**
	 * Opens a sales context.
	 */
	@Mutation('createChannel')
	@Permissions(PermissionsEnum.CHANNELS_CREATE)
	async createChannel(@Args('input') input: ICreateChannelInput): Promise<IChannel> {
		const channel = await this.channelService.createChannel(input as never);

		await this.channelEventPublisher.channelChanged(channel, 'created');

		return channel;
	}

	/**
	 * Changes the descriptive facts of a channel.
	 */
	@Mutation('updateChannel')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async updateChannel(@Args('input') input: IUpdateChannelInput): Promise<IChannel> {
		const channel = await this.channelService.updateChannel(input.id, input as never);

		await this.channelEventPublisher.channelChanged(channel, 'updated');

		return channel;
	}

	/**
	 * Retires a channel.
	 *
	 * The same operation the REST `DELETE /channels/:id` route performs, and the only removal this
	 * resource offers: a channel that has been traded on is archived rather than deleted, because the
	 * order side's reference to it is `RESTRICT`.
	 */
	@Mutation('deleteChannel')
	@Permissions(PermissionsEnum.CHANNELS_DELETE)
	async deleteChannel(@Args('id', { type: () => ID }) id: Id): Promise<IChannel> {
		const channel = await this.channelService.archiveChannel(id);

		await this.channelEventPublisher.channelChanged(channel, 'archived');

		return channel;
	}

	/**
	 * Claims the organization's default channel, releasing the flag from the previous holder.
	 */
	@Mutation('setDefaultChannel')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async setDefaultChannel(@Args('id', { type: () => ID }) id: Id): Promise<IChannel> {
		const channel = await this.channelService.setDefaultChannel(id);

		await this.channelEventPublisher.channelChanged(channel, 'default-changed');

		return channel;
	}

	/**
	 * Moves the channel along its lifecycle, and nowhere else.
	 */
	@Mutation('setChannelStatus')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async setChannelStatus(@Args('input') input: ISetChannelStatusInput): Promise<IChannel> {
		const channel = await this.channelService.setChannelStatus(input.id, input.status);

		await this.channelEventPublisher.channelChanged(channel, 'status-changed');

		return channel;
	}

	/**
	 * Replaces the channel's region links.
	 */
	@Mutation('replaceChannelRegions')
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	async replaceChannelRegions(@Args('input') input: IReplaceChannelRegionsInput): Promise<IChannelRegion[]> {
		const stored = await this.channelRegionService.replaceRegions(
			input.id,
			(input.items ?? []).map((member) => ({ regionId: member.regionId, isDefault: member.isDefault }))
		);
		// The channel's own aggregate changed with its region set, so the fact announced is the
		// channel's: a subscriber watching channels is not asked to watch a pivot as well.
		await this.channelEventPublisher.channelChanged(await this.channelService.findChannelOrFail(input.id), 'regions-replaced');

		return stored;
	}

	/**
	 * Streams every change to a channel of the caller's tenant.
	 *
	 * The topic is `<eventName>:<tenantId>`, so a subscription is structurally incapable of receiving
	 * another tenant's event even if the filter below were wrong — the filter is the second line, and
	 * it is where the two narrowing arguments are applied. Both only ever narrow what the credential
	 * may already read: a caller without `CHANNELS_VIEW` is refused by the guard before the stream is
	 * opened, and the tenant is taken from the credential rather than from an argument.
	 *
	 * Without a resolved tenant nothing is subscribed to: the topic of an unauthenticated connection
	 * is one no fact is ever published on, so the stream is silent rather than wide.
	 */
	@Subscription('channelChanged', {
		filter: (payload: IChannelChangedEnvelope, variables: { channelId?: Id; action?: string }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.channelId || String(payload.channel?.id) === String(variables.channelId)) &&
			(!variables?.action || payload.action === variables.action),
		resolve: (payload: IChannelChangedEnvelope) => payload.channel
	})
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	channelChanged(
		@Args('channelId', { type: () => ID, nullable: true }) channelId?: Id,
		@Args('action', { type: () => String, nullable: true }) action?: string
	): AsyncIterable<IChannelChangedEnvelope> {
		return this.pubSub.asyncIterableIterator<IChannelChangedEnvelope>(
			this.pubSub.topicFor(CHANNEL_EVENT_NAMES.CHANNEL_CHANGED, String(RequestContext.currentTenantId() ?? ''))
		);
	}
}
