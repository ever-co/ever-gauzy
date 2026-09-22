import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChannelStatus, IChannel, IChannelRegion, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Channel } from './channel.entity';
import { ChannelService } from './channel.service';
import { ChannelRegionService } from '../channel-region/channel-region.service';
import { ChannelEventPublisher } from './channel-event.publisher';
import {
	ChannelDetailQueryDTO,
	ChannelQueryDTO,
	CreateChannelDTO,
	DeleteChannelQueryDTO,
	ReplaceChannelRegionsDTO,
	SetChannelStatusDTO,
	UpdateChannelDTO
} from './dto';

/**
 * The sales context over REST.
 *
 * **A channel is what everything commercial is resolved for**, so this resource is the root of the
 * domain: its hostnames are how a request resolves to it, its region set is what it may sell into,
 * and the currency and providers a cart is priced with are read from the region it resolved. The
 * routes below are that root's own surface; the hostnames have theirs at `/channel-domains` and the
 * geography at `/regions`.
 *
 * **Every route speaks through `ChannelService`**, which owns the domain's four rules: at most one
 * default channel per organization and it is never removed, `code` is written once, a channel serves
 * only when it is `ACTIVE` and reachable, and its default region is one of its own. This class adds
 * permissions, validation and the list envelope — never a second copy of a rule.
 *
 * **Removal is retirement, and that is the domain's rule rather than this route's convenience.** The
 * order side's reference to a channel is `RESTRICT` precisely so an accidental delete fails loudly
 * instead of orphaning documents, so `DELETE` archives the channel and answers with the retired row.
 * The `force` member the endpoint table names is accepted and validated; it cannot make a hard delete
 * exist, because the service offers none — this is reported as the one place the delivered surface
 * departs from the endpoint table's `DeleteResult` cell.
 *
 * **Every inherited CRUD route this class overrides restates its own route decorator.** An override
 * replaces the property, so a dropped decorator is an endpoint that quietly stops existing — and
 * `create` and `update` are declared here rather than inherited because a body is validated from the
 * type the handler names, which the base class's generic is not.
 */
@ApiTags('Channel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CHANNELS_VIEW)
@Controller('/channels')
export class ChannelController extends CrudController<Channel> {
	constructor(
		private readonly channelService: ChannelService,
		private readonly channelRegionService: ChannelRegionService,
		private readonly channelEventPublisher: ChannelEventPublisher
	) {
		super(channelService);
	}

	/**
	 * Lists the channels of the caller's organization, the default one first.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of channels, with the relations the caller asked to expand.
	 */
	@ApiOperation({ summary: 'List channels' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channels retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_EXPAND_NOT_ALLOWED, QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: ChannelQueryDTO): Promise<IPagination<IChannel>> {
		const rows = await this.channelService.listChannels(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);
		const page = paginateRows(rows, take, skip);

		return this.withExpansions(page.items, query?.expand, page.total);
	}

	/**
	 * Reads one channel, optionally with its hostnames and its region set attached.
	 *
	 * @param id The channel to read.
	 * @param query Which relations to attach.
	 * @returns The channel.
	 */
	@ApiOperation({ summary: 'Find a channel by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	@Get(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query?: ChannelDetailQueryDTO
	): Promise<IChannel> {
		const channel = await this.channelService.findChannelOrFail(id);
		const expanded = await this.withExpansions([channel], query?.expand);

		return expanded.items[0];
	}

	/**
	 * Opens a sales context.
	 *
	 * @param entity The channel as the caller states it.
	 * @returns The stored channel, `DRAFT`.
	 */
	@ApiOperation({ summary: 'Create a channel' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Channel created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_FAILED, UNIQUE_CONSTRAINT_VIOLATION' })
	@Permissions(PermissionsEnum.CHANNELS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateChannelDTO): Promise<IChannel> {
		const channel = await this.channelService.createChannel(entity);

		await this.channelEventPublisher.channelChanged(channel, 'created');

		return channel;
	}

	/**
	 * Changes the descriptive facts of a channel.
	 *
	 * @param id The channel to change.
	 * @param entity The facts to change.
	 * @returns The stored channel.
	 */
	@ApiOperation({ summary: 'Update a channel' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_FAILED, PRECONDITION_REQUIRED' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateChannelDTO): Promise<IChannel> {
		const channel = await this.channelService.updateChannel(id, entity);

		await this.channelEventPublisher.channelChanged(channel, 'updated');

		return channel;
	}

	/**
	 * Moves the channel along its lifecycle, and nowhere else.
	 *
	 * The route exists because the GraphQL surface has the mutation of the same name and parity is
	 * capability parity: a caller must not have to change protocol to move a channel's status. The
	 * endpoint table does not name it, which is the one route this delivery adds beyond that table.
	 *
	 * @param id The channel to move.
	 * @param entity The status to move it to.
	 * @returns The stored channel.
	 */
	@ApiOperation({ summary: 'Move a channel along its lifecycle' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel status changed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_INVALID_ENUM, PRECONDITION_REQUIRED' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id/status')
	@UseValidationPipe({ transform: true, whitelist: true })
	async setChannelStatus(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SetChannelStatusDTO
	): Promise<IChannel> {
		const channel = await this.channelService.setChannelStatus(id, entity.status);

		await this.channelEventPublisher.channelChanged(channel, 'status-changed');

		return channel;
	}

	/**
	 * Claims the organization's default channel, releasing the flag from the previous holder.
	 *
	 * @param id The channel to make the default.
	 * @returns The stored channel.
	 */
	@ApiOperation({ summary: 'Mark a channel as the organization default' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Default channel changed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PRECONDITION_REQUIRED' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/set-default')
	async setDefault(@Param('id', UUIDValidationPipe) id: ID): Promise<IChannel> {
		const channel = await this.channelService.setDefaultChannel(id);

		await this.channelEventPublisher.channelChanged(channel, 'default-changed');

		return channel;
	}

	/**
	 * Replaces the channel's region links.
	 *
	 * The operation is a set rather than a member-per-call pair, because "remove a country" and "add a
	 * country" as two calls can each fail on their own and leave a set nobody asked for. A member the
	 * channel still names as its default region cannot be left out — invariant I-27 — and the service
	 * refuses the replacement rather than writing a state the two tables disagree about.
	 *
	 * @param id The channel whose region set is replaced.
	 * @param entity The regions the channel sells into afterwards.
	 * @returns The stored membership rows.
	 */
	@ApiOperation({ summary: "Replace a channel's region links" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Region links replaced' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PRECONDITION_REQUIRED, UNIQUE_CONSTRAINT_VIOLATION' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id/regions')
	@UseValidationPipe({ transform: true, whitelist: true })
	async replaceRegions(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReplaceChannelRegionsDTO
	): Promise<IChannelRegion[]> {
		const regions = (entity?.items ?? []).map((member) => ({
			regionId: member.regionId,
			isDefault: member.isDefault
		}));
		const stored = await this.channelRegionService.replaceRegions(id, regions);
		const channel = await this.channelService.findChannelOrFail(id);

		await this.channelEventPublisher.channelChanged(channel, 'regions-replaced');

		return stored;
	}

	/**
	 * Retires a channel.
	 *
	 * The channel keeps its rows — orders, carts, price lists and numbering series all name it — and
	 * stops serving, which is what retirement means. The organization's default channel is refused,
	 * because the fallback of the administration surface cannot be a retired storefront.
	 *
	 * @param id The channel to retire.
	 * @param query The `force` member the endpoint table names.
	 * @returns The stored channel, `ARCHIVED`.
	 */
	@ApiOperation({ summary: 'Retire a channel' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel archived' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PRECONDITION_REQUIRED (the default channel)' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() query?: DeleteChannelQueryDTO): Promise<IChannel> {
		const channel = await this.channelService.archiveChannel(id);

		await this.channelEventPublisher.channelChanged(channel, query?.force ? 'force-archived' : 'archived');

		return channel;
	}

	/**
	 * Attaches the relations the caller asked to expand.
	 *
	 * The allow-list is the DTO's, and the two relations are read through the services that own them
	 * rather than through a repository this class would have to reach for: a hostname list and a
	 * region set are each their own service's answer, and reading them any other way would be a
	 * second implementation of the order they are returned in.
	 *
	 * @param rows The channels.
	 * @param expand The relations to attach.
	 * @returns The page, unchanged in size or total.
	 */
	private async withExpansions(
		rows: readonly IChannel[],
		expand?: readonly string[],
		total?: number
	): Promise<IPagination<IChannel>> {
		const wanted = new Set(expand ?? []);

		if (wanted.size === 0) {
			return { items: [...rows], total: total ?? rows.length };
		}

		const items = await Promise.all(
			rows.map(async (channel) => {
				const expanded: IChannel = { ...channel };

				if (wanted.has('domains')) {
					expanded.domains = await this.channelService.listChannelDomains(channel.id);
				}

				if (wanted.has('regions')) {
					expanded.regions = await this.channelService.listChannelRegions(channel.id);
				}

				return expanded;
			})
		);

		return { items, total: total ?? rows.length };
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * Members that were not stated are left out rather than written as `undefined`, because a
	 * repository handed an explicit `undefined` asks the database for a row whose column *is* null —
	 * which is a different question from "do not narrow on this column". `isDefault` is the one member
	 * whose `false` is a question rather than an absence, so it is kept when it is stated.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: ChannelQueryDTO): {
		status?: ChannelStatus;
		code?: string;
		isDefault?: boolean;
		withDeleted?: boolean;
	} {
		const stated: {
			status?: ChannelStatus;
			code?: string;
			isDefault?: boolean;
			withDeleted?: boolean;
		} = {};

		for (const member of ['status', 'code', 'isDefault'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		// Visibility is not a member of the bracketed filter — it is the same on both surfaces and is stated
		// flat — and it is kept only when true, because `false` here asks for exactly what omitting it asks
		// for. The read is what turns it into the kernel's option.
		if (query?.withDeleted) {
			stated.withDeleted = true;
		}

		return stated;
	}
}
