import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ChannelRegionRefusalReason,
	ChannelStatus,
	IChannel,
	IChannelCreateInput,
	IChannelDomain,
	IChannelFindInput,
	IChannelRegion,
	IChannelUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ChannelDomainService } from '../channel-domain/channel-domain.service';
import { ChannelRegionService } from '../channel-region/channel-region.service';
import { Organization } from '../organization/organization.entity';
import { Channel } from './channel.entity';
import { TypeOrmChannelRepository } from './repository/type-orm-channel.repository';
import { MikroOrmChannelRepository } from './repository/mikro-orm-channel.repository';

/**
 * The sales context, and the four rules a storefront cannot be opened without.
 *
 * **1. At most one default channel per organization, and it is never removed.** The partial unique index
 * makes two live defaults impossible; the write that claims the flag releases it from the previous
 * holder in one transaction, because an index can state "at most one" and cannot *move* it. The default
 * is the fallback of the administration surface — an operator who states no channel — and it is
 * therefore never deleted or archived, which is the rule the API specification reports as
 * `CHANNEL_DEFAULT_IMMUTABLE`.
 *
 * **2. `code` is written once.** It is what a storefront URL, a seed file and an import mapping name, so
 * this service refuses to change it. The schema chapter makes it immutable once an order names the
 * channel; refusing every change is the stricter form of the same rule and the one that can be decided
 * here, because the order table belongs to a package this service must not read.
 *
 * **3. A channel serves only when it is `ACTIVE` and reachable.** `ACTIVE` is the only status that
 * answers requests — the API specification's `CHANNEL_INACTIVE` is what every other status produces —
 * and a channel reaches `ACTIVE` only once at least one hostname resolves to it, which is the invariant
 * I-25, checked against the hostname service in the same call that moves the status.
 *
 * **4. The channel's default region is one of its own.** `defaultRegionId` names the region a request
 * that resolved no region is priced in, and the invariant I-27 is that the region is also a member of
 * the channel's region set. The membership is written first, through the pivot's service, and it cannot
 * then be withdrawn while the channel still names it — so the two rows cannot disagree, which is the
 * state the schema chapter says must be impossible.
 *
 * **Removal.** A channel that has been traded on is archived, never deleted: the order side's reference
 * is `RESTRICT` precisely so that an accidental delete fails loudly instead of orphaning documents. The
 * soft delete this service offers is refused for the organization's default channel, and the hard delete
 * is not offered at all.
 */
@Injectable()
export class ChannelService extends TenantAwareCrudService<Channel> {
	/**
	 * The lifecycle the channel moves along.
	 *
	 * `DRAFT → ACTIVE | ARCHIVED`, `ACTIVE ↔ INACTIVE`, and `ARCHIVED` terminal. A draft is a channel
	 * being configured, so it does not pass through `INACTIVE` — a channel that was never switched on has
	 * not been switched off — and `ARCHIVED` is the end of the line, because a channel that came back
	 * would be one whose retirement the orders naming it never saw.
	 */
	private static readonly TRANSITIONS: Record<ChannelStatus, ChannelStatus[]> = {
		[ChannelStatus.DRAFT]: [ChannelStatus.ACTIVE, ChannelStatus.ARCHIVED],
		[ChannelStatus.ACTIVE]: [ChannelStatus.INACTIVE, ChannelStatus.ARCHIVED],
		[ChannelStatus.INACTIVE]: [ChannelStatus.ACTIVE, ChannelStatus.ARCHIVED],
		[ChannelStatus.ARCHIVED]: []
	};

	constructor(
		readonly typeOrmChannelRepository: TypeOrmChannelRepository,
		readonly mikroOrmChannelRepository: MikroOrmChannelRepository,
		/**
		 * The hostname service, for the invariant I-25: a channel reaches `ACTIVE` only when a request can
		 * resolve to it, and the hostname table is the only thing that answers that.
		 */
		private readonly channelDomainService: ChannelDomainService,
		/**
		 * The publication pivot, for the invariant I-27 and for the second fallback region a channel
		 * carries. The dependency runs one way: the pivot reads the channel table through its repository
		 * rather than through this service, so no cycle exists between the two.
		 */
		private readonly channelRegionService: ChannelRegionService,
		/**
		 * The organization, read for the one fact a channel inherits from it rather than decides: the
		 * currency a document created without one is denominated in.
		 *
		 * Read through the platform's TypeORM repository, which is the pattern the platform already uses
		 * wherever a value has to be read before a row is written — the authorization guard reads an
		 * organization exactly this way — and **not** by importing `OrganizationModule`: this module is
		 * reached from the kernel barrel, and importing the organization's module from here closes a
		 * require cycle through the token module that leaves `TokenModule` undefined while it is being
		 * decorated. The table is all this read needs, so the table's entity is what it asks for.
		 */
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {
		super(typeOrmChannelRepository, mikroOrmChannelRepository);
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
	 * Opens a sales context.
	 *
	 * The channel starts `DRAFT` — nothing serves until an operator binds a hostname and activates it —
	 * and it is not the organization's default until that is asked for, because a default is a statement
	 * about an organization and not about a row that was just created. The code is trimmed and refused
	 * if the organization already uses it among its live rows.
	 *
	 * @param input The channel as the caller states it.
	 * @returns The stored channel, `DRAFT`.
	 * @throws BadRequestException when the name or the code is absent, when the currency is not a
	 * three-letter code, or when the code is already taken inside the organization.
	 */
	async createChannel(input: IChannelCreateInput): Promise<IChannel> {
		const name = input?.name ? String(input.name).trim() : '';
		const code = input?.code ? String(input.code).trim() : '';

		if (!name) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a channel is stated with a name, and none was presented.`
			);
		}

		if (!code) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a channel is stated with a code, and none was presented; the code is what a URL, a seed and an import name.`
			);
		}

		if (await this.findByCode(code)) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: a channel with code '${code}' already exists in this organization.`
			);
		}

		const currency = input?.defaultCurrency
			? String(input.defaultCurrency).trim().toUpperCase()
			: await this.organizationCurrency();

		if (currency.length !== 3) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: '${currency}' is not a currency code; a channel's default currency is the three-letter code of a currency the platform knows.`
			);
		}

		return this.create({
			...input,
			name,
			code,
			// Stated rather than left to the column's own default: the currency a document created
			// without one is denominated in is the *organization's*, and the column's own default is a
			// constant that would silently disagree with the organization on every deployment whose
			// currency is not that constant.
			defaultCurrency: currency,
			orderNumberPadding: input?.orderNumberPadding ?? 6,
			status: ChannelStatus.DRAFT,
			isDefault: false,
			...this.scope
		} as never);
	}

	/**
	 * Lists the channels of the caller's organization.
	 *
	 * @param filter Optional narrowing by status, code or default flag.
	 * @returns The channels, default first and then newest first.
	 */
	async listChannels(filter: IChannelFindInput = {}): Promise<IChannel[]> {
		const channels: Channel[] = await this.find({
			where: {
				...(filter.status ? { status: filter.status } : {}),
				...(filter.code ? { code: filter.code } : {}),
				...(filter.isDefault !== undefined ? { isDefault: filter.isDefault } : {}),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);

		return (channels ?? []).slice().sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
	}

	/**
	 * Reads one channel of the caller's organization, answering null when there is none.
	 *
	 * @param id The channel id.
	 * @returns The channel, or null.
	 */
	async findChannel(id: ID): Promise<IChannel | null> {
		const channels: Channel[] = await this.find({ where: { id, ...this.scope } } as never);

		return channels.length ? channels[0] : null;
	}

	/**
	 * Loads a channel that belongs to the caller's organization.
	 *
	 * @param id The channel id.
	 * @returns The channel.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findChannelOrFail(id: ID): Promise<IChannel> {
		const channel = await this.findChannel(id);

		if (!channel) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
					ChannelRegionRefusalReason.CHANNEL_NOT_FOUND
				} — channel '${String(id)}' could not be found.`
			);
		}

		return channel;
	}

	/**
	 * The organization's default channel, when it has one.
	 *
	 * The default is what an **administration** read falls back to when an operator states no channel. It
	 * is deliberately not what a *request* falls back to: a request that could not resolve a channel is
	 * refused, because silently pricing through another storefront's configuration is the leak the
	 * channel-scope guard exists to prevent.
	 *
	 * @returns The default channel, or null.
	 */
	async findDefaultChannel(): Promise<IChannel | null> {
		const channels: Channel[] = await this.find({ where: { isDefault: true, ...this.scope } } as never);

		return channels.length ? channels[0] : null;
	}

	/**
	 * The channel of the caller's organization under one code.
	 *
	 * @param code The channel code.
	 * @returns The channel, or null.
	 */
	async findChannelByCode(code: string): Promise<IChannel | null> {
		return this.findByCode(String(code ?? '').trim());
	}

	/**
	 * The regions published to a channel.
	 *
	 * @param id The channel.
	 * @returns The membership rows, fallback region first.
	 */
	async listChannelRegions(id: ID): Promise<IChannelRegion[]> {
		await this.findChannelOrFail(id);

		return this.channelRegionService.listRegions(id);
	}

	/**
	 * The hostnames that resolve to a channel.
	 *
	 * @param id The channel.
	 * @returns The hostname rows, primary first.
	 */
	async listChannelDomains(id: ID): Promise<IChannelDomain[]> {
		await this.findChannelOrFail(id);

		return this.channelDomainService.listDomains(id);
	}

	/**
	 * Changes the descriptive facts of a channel.
	 *
	 * The code is refused rather than ignored: a caller that believes it renamed the stable key has a bug
	 * it would otherwise never see, and every URL and import that names the channel would keep pointing
	 * at the old value. The status, the default flag and the default region are absent for the same
	 * reason — each has an operation of its own.
	 *
	 * @param id The channel to change.
	 * @param input The facts to change.
	 * @returns The stored channel.
	 * @throws BadRequestException when the body states a `code`, or a currency that is not three letters.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async updateChannel(id: ID, input: IChannelUpdateInput): Promise<IChannel> {
		await this.findChannelOrFail(id);

		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		if (stated['code'] !== undefined && stated['code'] !== null) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_CODE_IMMUTABLE
				} — a channel's code is written once; it is what a storefront URL, a seed file and an import mapping name.`
			);
		}

		const currency =
			input.defaultCurrency !== undefined ? String(input.defaultCurrency).trim().toUpperCase() : undefined;

		if (currency !== undefined && currency.length !== 3) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: '${currency}' is not a currency code; a channel's default currency is the three-letter code of a currency the platform knows.`
			);
		}

		await this.update(id, {
			...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
			...(input.description !== undefined ? { description: input.description } : {}),
			...(currency !== undefined ? { defaultCurrency: currency } : {}),
			...(input.defaultLocale !== undefined ? { defaultLocale: input.defaultLocale } : {}),
			...(input.orderNumberPrefix !== undefined ? { orderNumberPrefix: input.orderNumberPrefix } : {}),
			...(input.orderNumberPadding !== undefined ? { orderNumberPadding: input.orderNumberPadding } : {}),
			...(input.settings !== undefined ? { settings: input.settings } : {}),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findChannelOrFail(id);
	}

	/**
	 * Moves the channel along its lifecycle, and nowhere else.
	 *
	 * Reaching `ACTIVE` is the one move that carries an extra requirement: the channel must already have a
	 * hostname, because a channel that no request can resolve to would be `ACTIVE` in the database and
	 * unreachable in fact — the invariant I-25. The check runs inside the same call that writes the
	 * status, so an operator cannot activate a storefront that has no address.
	 *
	 * @param id The channel to move.
	 * @param next The status to move it to.
	 * @returns The stored channel.
	 * @throws BadRequestException when the status is not one a channel can hold, when the graph does not
	 * contain the move, or when `ACTIVE` is reached with no hostname bound.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async setChannelStatus(id: ID, next: ChannelStatus): Promise<IChannel> {
		if (!next || !Object.values(ChannelStatus).includes(next)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_INVALID_ENUM}: '${String(next)}' is not a status a channel can hold.`
			);
		}

		const channel = await this.findChannelOrFail(id);

		if (!ChannelService.TRANSITIONS[channel.status]?.includes(next)) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_STATUS_INVALID
				} — a channel moves from ${channel.status} to ${
					ChannelService.TRANSITIONS[channel.status]?.join(', ') || 'nothing'
				}, and ${next} is not one of them.`
			);
		}

		if (next === ChannelStatus.ACTIVE && channel.status !== ChannelStatus.ACTIVE) {
			// Invariant I-25, checked before the status moves rather than after it.
			await this.channelDomainService.assertServable(id);
		}

		await this.update(id, { status: next } as never);

		return this.findChannelOrFail(id);
	}

	/**
	 * Claims the organization's default channel, releasing the flag from the previous holder.
	 *
	 * Both writes happen inside one transaction, against rows the transaction holds, so two concurrent
	 * claims cannot both read an unclaimed flag and both take it. An archived channel is refused: the
	 * fallback of the administration surface must be a channel that still exists as a storefront.
	 *
	 * @param id The channel to make the default.
	 * @returns The stored channel.
	 * @throws BadRequestException when the channel is archived.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async setDefaultChannel(id: ID): Promise<IChannel> {
		const saved = await this.typeOrmChannelRepository.manager.transaction(async (manager) => {
			const channel = await this.lockChannel(manager, id);

			if (!channel) {
				throw new NotFoundException(
					`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
						ChannelRegionRefusalReason.CHANNEL_NOT_FOUND
					} — channel '${String(id)}' could not be found.`
				);
			}

			if (channel.status === ChannelStatus.ARCHIVED) {
				throw new BadRequestException(
					`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
						ChannelRegionRefusalReason.CHANNEL_STATUS_INVALID
					} — an ARCHIVED channel is retired and is never made the default channel of an organization.`
				);
			}

			const current: Channel[] = await manager.find(Channel, {
				where: { isDefault: true, ...this.scope }
			} as never);

			for (const other of current) {
				if (other.id !== channel.id && !other.deletedAt) {
					other.isDefault = false;
					await manager.save(Channel, other);
				}
			}

			channel.isDefault = true;

			return manager.save(Channel, channel);
		});

		return this.findChannelOrFail(saved.id);
	}

	/**
	 * Names the region a request that resolved no region is priced in.
	 *
	 * The region has to be published to the channel first — invariant I-27 — and the membership is
	 * checked by the pivot's own service rather than inferred from this table, so the column can only ever
	 * name a region the channel actually offers. The pivot's fallback flag is a *second* fallback and is
	 * not written here: it is read when this column is null, and forcing the two to be equal would lose
	 * the distinction the schema draws between them.
	 *
	 * @param id The channel.
	 * @param regionId The region to name.
	 * @returns The stored channel.
	 * @throws BadRequestException when the region is not published to the channel.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async setDefaultRegion(id: ID, regionId: ID): Promise<IChannel> {
		await this.findChannelOrFail(id);
		await this.channelRegionService.assertRegionEnabled(id, regionId);
		await this.update(id, { defaultRegionId: regionId } as never);

		return this.findChannelOrFail(id);
	}

	/**
	 * Clears the region a request that resolved no region is priced in.
	 *
	 * The membership row is deliberately left in place: the channel still offers the region, it simply no
	 * longer names it as the fallback, and the pivot's own flag then decides. Removing the membership is
	 * the pivot's operation and is refused while this column names it, so the two cannot be cleared in the
	 * wrong order.
	 *
	 * @param id The channel.
	 * @returns The stored channel.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async clearDefaultRegion(id: ID): Promise<IChannel> {
		await this.findChannelOrFail(id);
		await this.update(id, { defaultRegionId: null } as never);

		return this.findChannelOrFail(id);
	}

	/**
	 * Refuses a channel that does not serve requests.
	 *
	 * Read as a statement about behaviour: only `ACTIVE` serves, so `DRAFT`, `INACTIVE` and `ARCHIVED` are
	 * all refusals, and the message names the status so that a client can tell "not configured yet" from
	 * "switched off deliberately".
	 *
	 * @param channel The channel about to serve a request.
	 * @throws BadRequestException for every status but `ACTIVE`.
	 */
	assertServing(channel: IChannel): void {
		if (channel?.status === ChannelStatus.ACTIVE) {
			return;
		}

		throw new BadRequestException(
			`${ApiErrorCode.CHANNEL_NOT_RESOLVED}: ${ChannelRegionRefusalReason.CHANNEL_INACTIVE} — channel '${
				channel?.code ?? String(channel?.id ?? '')
			}' is ${channel?.status ?? 'missing'} and does not serve requests.`
		);
	}

	/**
	 * Retires a channel without deleting it.
	 *
	 * Idempotent, and refused for the organization's default channel: the fallback of the administration
	 * surface cannot be a retired storefront, which is the rule the API specification reports as
	 * `CHANNEL_DEFAULT_IMMUTABLE`. The channel keeps its rows — orders, carts, price lists and numbering
	 * series all name it — and stops serving, which is what retirement means.
	 *
	 * @param id The channel to retire.
	 * @returns The stored channel, `ARCHIVED`.
	 * @throws BadRequestException when the channel is the organization's default.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async archiveChannel(id: ID): Promise<IChannel> {
		const channel = await this.findChannelOrFail(id);

		if (channel.isDefault) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_DEFAULT_IMMUTABLE
				} — channel '${channel.code}' is the default channel of this organization; name another default before retiring it.`
			);
		}

		if (channel.status === ChannelStatus.ARCHIVED) {
			return channel;
		}

		await this.update(id, { status: ChannelStatus.ARCHIVED, isArchived: true, archivedAt: new Date() } as never);

		return this.findChannelOrFail(id);
	}

	/**
	 * Soft-deletes a channel, which is the only removal path this service offers.
	 *
	 * Refused for the organization's default channel for the same reason archiving is: the default is what
	 * an administration read falls back to, and a deleted default is a fallback that resolves to nothing.
	 * A channel that has been traded on is protected by the order side's `RESTRICT` reference, so a hard
	 * delete fails at the database rather than orphaning documents — this method never attempts one.
	 *
	 * @param id The channel to soft-delete.
	 * @returns The stored channel.
	 * @throws BadRequestException when the channel is the organization's default.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async softRemoveChannel(id: ID): Promise<IChannel> {
		const channel = await this.findChannelOrFail(id);

		if (channel.isDefault) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_DEFAULT_IMMUTABLE
				} — channel '${channel.code}' is the default channel of this organization; name another default before removing it.`
			);
		}

		await this.softDelete(id);

		return this.findChannelOrFail(id);
	}

	/**
	 * The currency a channel inherits from its organization.
	 *
	 * A channel does not choose its currency: the organization's ledgers, its tax configuration and the
	 * documents already written in it are all denominated in one currency, and a channel that defaulted to
	 * a different one would price the same catalogue differently per storefront. So when a caller states no
	 * currency the organization's own is read here and written on the row, which is the only way the column
	 * can be right on a deployment whose currency is not the column's constant default.
	 *
	 * A missing organization row, or one that states nothing usable, falls back to that constant rather
	 * than refusing the write: the caller has already been authenticated against the organization, so a
	 * currency that cannot be read is a gap in the organization's own configuration and not a reason to
	 * leave the channel unwritable.
	 *
	 * @returns The organization's currency, or the schema's fallback when it states none.
	 */
	private async organizationCurrency(): Promise<string> {
		const organizationId = this.scope.organizationId;

		if (!organizationId) {
			return 'USD';
		}

		const organization = await this.organizationRepository.findOne({
			where: { id: organizationId },
			select: { id: true, currency: true }
		} as never);

		const currency = organization?.currency ? String(organization.currency).trim().toUpperCase() : '';

		return currency.length === 3 ? currency : 'USD';
	}

	/**
	 * Finds the organization's channel under one code.
	 *
	 * @param code The channel code.
	 * @param exceptId A channel to exclude from the probe, when one row is being edited.
	 * @returns The channel already holding the code, or null.
	 */
	private async findByCode(code: string, exceptId?: ID): Promise<Channel | null> {
		if (!code) {
			return null;
		}

		const channels: Channel[] = await this.find({ where: { code, ...this.scope } } as never);
		const other = (channels ?? []).filter((row) => row.id !== exceptId);

		return other.length ? other[0] : null;
	}

	/**
	 * Reads the channel under a lock where the dialect supports one.
	 *
	 * The default rule is decided from the flag's current holder, so the row is held for the decision
	 * rather than read and written around. The embedded dialect serializes writers on its own, so there
	 * the surrounding transaction is the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param id The channel to lock.
	 * @returns The locked channel, or null when it does not exist.
	 */
	private async lockChannel(manager: EntityManager, id: ID): Promise<Channel | null> {
		const query = manager.createQueryBuilder(Channel, 'channel').where({ id, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}
}
