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
import { IChannelDomain, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ChannelDomain } from './channel-domain.entity';
import { ChannelDomainService } from './channel-domain.service';
import { IChannelDomainVerification, verifyChannelDomain } from './channel-domain-verification';
import {
	ChannelDomainQueryDTO,
	CreateChannelDomainDTO,
	DeleteChannelDomainQueryDTO,
	IChannelDomainListFilter,
	UpdateChannelDomainDTO
} from './dto';

/**
 * Hostname → channel resolution over REST.
 *
 * **One row, one question.** The table exists so that an incoming `Host` header resolves to a channel
 * in one indexed read, before any other guard runs, and every route below is that question's
 * administration surface: which hostnames resolve to which channel, which of them is canonical, and
 * whether a binding currently reaches the channel it names.
 *
 * **The permission is the channel's, not a pair of its own.** A hostname has no meaning without its
 * channel and no access rule that the channel does not already have, so this resource carries
 * `CHANNELS_*` — which is what the endpoint table says and what the placement doctrine says a
 * dimension of another resource gets.
 *
 * **Unbinding is a soft delete and the last hostname is refused without `force`.** A channel nobody
 * can reach cannot serve (invariant I-25), so the removal that would leave a channel unreachable is a
 * refusal a caller has to state its way past.
 *
 * **Every inherited CRUD route this class overrides restates its own route decorator**, and `create`
 * and `update` are declared here rather than inherited because a body is validated from the type the
 * handler names.
 */
@ApiTags('ChannelDomain')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CHANNELS_VIEW)
@Controller('/channel-domains')
export class ChannelDomainController extends CrudController<ChannelDomain> {
	constructor(private readonly channelDomainService: ChannelDomainService) {
		super(channelDomainService);
	}

	/**
	 * Lists the hostnames of the caller's organization, optionally of one channel, primary first.
	 *
	 * The delivered service lists one channel's hostnames — its `listDomains` takes the channel — and
	 * the endpoint table's list route is organization-wide with the channel as one of its filters. The
	 * organization-wide read is therefore composed here from the same service's scoped `find`, with
	 * the same filter members and the same order its own list uses, rather than by widening a service
	 * signature this delivery may not change.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of hostnames, primary first.
	 */
	@ApiOperation({ summary: 'List channel domains' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel domains retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: ChannelDomainQueryDTO): Promise<IPagination<ChannelDomain>> {
		const filter = this.narrowing(query);
		const rows = filter.channelId
			? await this.channelDomainService.listDomains(filter.channelId, filter)
			: this.primaryFirst(await this.channelDomainService.find({ where: { ...filter } } as never));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);
		const page = paginateRows(rows, take, skip);

		return { items: page.items.map((row) => this.asStored(row)), total: page.total };
	}

	/**
	 * Reads one hostname.
	 *
	 * @param id The hostname row to read.
	 * @returns The hostname.
	 */
	@ApiOperation({ summary: 'Find a channel domain by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel domain retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<ChannelDomain> {
		return this.asStored(await this.channelDomainService.findDomainOrFail(id));
	}

	/**
	 * Attaches a hostname to a channel.
	 *
	 * @param entity The hostname and the channel it resolves to.
	 * @returns The stored hostname.
	 */
	@ApiOperation({ summary: 'Bind a hostname to a channel' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Hostname bound' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'VALIDATION_FAILED, CHANNEL_DOMAIN_ALREADY_EXISTS, CHANNEL_DOMAIN_PRIMARY_EXISTS'
	})
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateChannelDomainDTO): Promise<ChannelDomain> {
		return this.asStored(await this.channelDomainService.bindDomain(entity));
	}

	/**
	 * Changes the flags of a hostname that exists.
	 *
	 * @param id The hostname row to change.
	 * @param entity The flags to change.
	 * @returns The stored hostname.
	 */
	@ApiOperation({ summary: 'Update a channel domain' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Channel domain updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateChannelDomainDTO
	): Promise<ChannelDomain> {
		return this.asStored(await this.channelDomainService.updateDomain(id, entity));
	}

	/**
	 * Answers whether a hostname reaches the channel it is bound to.
	 *
	 * @param id The hostname row to check.
	 * @returns Whether it resolves, to what, and when it was checked.
	 */
	@ApiOperation({ summary: 'Verify DNS/TLS readiness of a hostname' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Hostname checked' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/verify')
	async verify(@Param('id', UUIDValidationPipe) id: ID): Promise<IChannelDomainVerification> {
		return verifyChannelDomain(this.channelDomainService, await this.channelDomainService.findDomainOrFail(id));
	}

	/**
	 * Detaches a hostname from its channel.
	 *
	 * @param id The hostname row to withdraw.
	 * @param query Whether the caller accepts leaving the channel unreachable.
	 * @returns The removed hostname row, as it was stored.
	 */
	@ApiOperation({ summary: 'Detach a hostname from a channel' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Hostname unbound' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PRECONDITION_REQUIRED (the last hostname)' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.CHANNELS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query?: DeleteChannelDomainQueryDTO
	): Promise<ChannelDomain> {
		return this.asStored(await this.channelDomainService.unbindDomain(id, { force: query?.force }));
	}

	/**
	 * Reads a value the service answers with as the row the base controller's contract names.
	 *
	 * The service layer speaks the contract interface, where a relation a read may not load is
	 * optional — `IChannelDomain.channel` is `IChannel | undefined` — while the entity that implements
	 * it declares `channel` required, because the reference is what the row is. `CrudController<T>`
	 * is typed by the entity, so an override whose signature returns the interface is not a valid
	 * override: the two differ in exactly that one member's optionality.
	 *
	 * The narrowing is therefore stated once, here, and it is true at runtime: what the service
	 * returns is the row it just read or wrote, which is an instance of this entity. The mismatch is
	 * reported rather than repaired in place, because the entity was delivered by a previous round
	 * and relaxing `channel` to `channel?` there is the owner's call — it is a type-only change with
	 * no column behind it, since the nullability lives on the relation decorator and on `channelId`.
	 *
	 * @param domain The row as the service answers with it.
	 * @returns The same row, as the entity the base controller is typed by.
	 */
	private asStored(domain: IChannelDomain): ChannelDomain {
		return domain as ChannelDomain;
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: ChannelDomainQueryDTO): IChannelDomainListFilter {
		const stated: { channelId?: ID; hostname?: string; isPrimary?: boolean } = {};

		for (const member of ['channelId', 'hostname', 'isPrimary'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		return stated;
	}

	/**
	 * Orders hostnames the way the service's own channel list orders them: the canonical host first.
	 *
	 * @param rows The rows.
	 * @returns The rows, primary first.
	 */
	private primaryFirst(rows: readonly IChannelDomain[]): IChannelDomain[] {
		return [...rows].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
	}
}
