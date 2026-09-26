import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ChannelRegionRefusalReason,
	IChannelDomain,
	IChannelDomainCreateInput,
	IChannelDomainFindInput,
	IChannelDomainUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ChannelDomain } from './channel-domain.entity';
import { TypeOrmChannelDomainRepository } from './repository/type-orm-channel-domain.repository';
import { MikroOrmChannelDomainRepository } from './repository/mikro-orm-channel-domain.repository';

/**
 * Which channel an incoming request is for.
 *
 * **One question, one indexed read.** The channel-scope guard has to know the channel of a request
 * before it can decide whether the caller may see anything at all, so resolution may not read every
 * channel of every tenant: it reads this table by hostname, which the partial unique index over the
 * live rows makes a single-row lookup.
 *
 * **Three rules this service owns.**
 *
 * 1. **A hostname is stored in exactly one form.** The header arrives in whatever case and shape the
 *    client sent it — with a port, with a trailing dot, occasionally with a scheme — and a row that kept
 *    the caller's spelling would resolve for one client and not for the next. Every write and every
 *    lookup passes through one normaliser, so the stored value and the probed value cannot differ.
 * 2. **A hostname resolves to one channel, across the whole deployment.** Uniqueness is not scoped by
 *    tenant, because the header is global: two tenants claiming one host would make the answer depend on
 *    the order the rows were read in, in the one request that cannot ask a clarifying question.
 * 3. **Exactly one primary per channel.** The primary host is the canonical one — what a storefront link
 *    is written with and what the other hosts redirect to — so a channel with a primary refuses a second
 *    one at the create, and an update is what moves the flag. A channel whose set is empty makes its
 *    first host primary, because a channel with hostnames and no canonical one has no link to publish.
 *
 * **A channel serves only once it has a hostname** — invariant I-25. {@link assertServable} is the check
 * the channel's own activation runs; the removal of the last hostname is refused for the same reason,
 * and a caller that genuinely wants a channel with no reachable host states `force` and accepts that the
 * channel is no longer servable until a hostname is bound again.
 */
@Injectable()
export class ChannelDomainService extends TenantAwareCrudService<ChannelDomain> {
	constructor(
		readonly typeOrmChannelDomainRepository: TypeOrmChannelDomainRepository,
		readonly mikroOrmChannelDomainRepository: MikroOrmChannelDomainRepository
	) {
		super(typeOrmChannelDomainRepository, mikroOrmChannelDomainRepository);
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
	 * Binds a hostname to a channel.
	 *
	 * The hostname is normalised before anything is read, so the uniqueness probe and the stored value
	 * are the same string. The first hostname of a channel becomes its primary whatever the body says,
	 * because a channel with hosts and no canonical host has no link to publish; a channel that already
	 * has a primary refuses a second one here, and {@link setPrimaryDomain} or an update is what moves
	 * the flag, so that replacing the canonical host is a deliberate operation rather than a side effect
	 * of adding a host.
	 *
	 * @param input The hostname and the channel it resolves to.
	 * @returns The stored hostname.
	 * @throws BadRequestException when the hostname is absent or is not a hostname, when it is already
	 * bound, or when the channel already carries a primary host.
	 */
	async bindDomain(input: IChannelDomainCreateInput): Promise<IChannelDomain> {
		if (!input?.channelId) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a hostname is bound to a channel, and no channel was presented.`
			);
		}

		const hostname = this.normaliseHostname(input?.hostname);
		const bound = await this.findByHostname(hostname);

		if (bound) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: ${
					ChannelRegionRefusalReason.CHANNEL_DOMAIN_ALREADY_EXISTS
				} — hostname '${hostname}' is already bound to channel '${String(bound.channelId)}'.`
			);
		}

		const existing = await this.listDomains(input.channelId);
		const primary = existing.find((one) => one.isPrimary);

		if (input.isPrimary && primary) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: ${
					ChannelRegionRefusalReason.CHANNEL_DOMAIN_PRIMARY_EXISTS
				} — channel '${String(input.channelId)}' is already published on '${primary.hostname}'; move the flag rather than adding a second canonical host.`
			);
		}

		return this.create({
			...input,
			hostname,
			isPrimary: input.isPrimary ?? existing.length === 0,
			isSslEnabled: input.isSslEnabled ?? true,
			redirectToPrimary: input.redirectToPrimary ?? false,
			...this.scope
		} as never);
	}

	/**
	 * Lists the hostnames of one channel.
	 *
	 * @param channelId The channel.
	 * @param filter Optional narrowing by hostname or primary flag.
	 * @returns The hostnames, primary first.
	 */
	async listDomains(channelId: ID, filter: IChannelDomainFindInput = {}): Promise<IChannelDomain[]> {
		const domains: ChannelDomain[] = await this.find({
			where: {
				channelId,
				...(filter.hostname ? { hostname: filter.hostname } : {}),
				...(filter.isPrimary !== undefined ? { isPrimary: filter.isPrimary } : {}),
				...this.scope
			}
		} as never);

		return (domains ?? []).slice().sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
	}

	/**
	 * Reads one hostname of the caller's organization.
	 *
	 * @param id The hostname row id.
	 * @returns The hostname, or null.
	 */
	async findDomain(id: ID): Promise<IChannelDomain | null> {
		const domains: ChannelDomain[] = await this.find({ where: { id, ...this.scope } } as never);

		return domains.length ? domains[0] : null;
	}

	/**
	 * Loads a hostname that belongs to the caller's organization.
	 *
	 * @param id The hostname row id.
	 * @returns The hostname.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findDomainOrFail(id: ID): Promise<IChannelDomain> {
		const domain = await this.findDomain(id);

		if (!domain) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
					ChannelRegionRefusalReason.CHANNEL_DOMAIN_NOT_FOUND
				} — hostname row '${String(id)}' could not be found.`
			);
		}

		return domain;
	}

	/**
	 * The channel's canonical host, when it has one.
	 *
	 * @param channelId The channel.
	 * @returns The primary hostname, or null.
	 */
	async findPrimaryDomain(channelId: ID): Promise<IChannelDomain | null> {
		const primary = (await this.listDomains(channelId)).find((one) => one.isPrimary);

		return primary ?? null;
	}

	/**
	 * The channel a hostname resolves to, which is the read the request guard is built on.
	 *
	 * Deliberately **not** scoped by tenant: the header is global, and the row that owns the hostname is
	 * the only row that can answer. The answer is the channel id alone, because that is what the guard
	 * writes into the request context; the channel's own row is read afterwards, through the channel
	 * service, where the scope check belongs.
	 *
	 * @param hostname The host, as the request presented it.
	 * @returns The channel id, or null when no live hostname matches.
	 */
	async resolveChannelIdByHostname(hostname: string): Promise<ID | null> {
		const normalised = this.normaliseHostname(hostname, false);

		if (!normalised) {
			return null;
		}

		const bound = await this.typeOrmChannelDomainRepository.findOne({
			where: { hostname: normalised, deletedAt: null } as never
		});

		return bound?.channelId ?? null;
	}

	/**
	 * Changes the flags of a hostname that exists.
	 *
	 * The hostname itself and the channel it belongs to are not editable: a binding that could be
	 * re-pointed is a binding whose resolution changes under the requests that already resolved it, so
	 * rebinding is an unbind followed by a bind. Setting `isPrimary` here **moves** the flag from the
	 * current primary — an update is the deliberate operation, so it does not need to be told twice.
	 *
	 * @param id The hostname row to change.
	 * @param input The flags to change.
	 * @returns The stored hostname.
	 * @throws NotFoundException when the hostname is not in the caller's scope.
	 */
	async updateDomain(id: ID, input: IChannelDomainUpdateInput): Promise<IChannelDomain> {
		const domain = await this.findDomainOrFail(id);

		if (input.isPrimary === true) {
			await this.setPrimaryDomain(domain.channelId, domain.id);
		}

		await this.update(id, {
			...(input.isSslEnabled !== undefined ? { isSslEnabled: input.isSslEnabled } : {}),
			...(input.redirectToPrimary !== undefined ? { redirectToPrimary: input.redirectToPrimary } : {}),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findDomainOrFail(id);
	}

	/**
	 * Makes one hostname the channel's canonical host, releasing the flag from the current holder.
	 *
	 * Both writes happen in one transaction so that the channel is never left with two canonical hosts
	 * — the state the partial unique index would reject at commit time, after both callers had been told
	 * they had it — and never with none.
	 *
	 * @param channelId The channel.
	 * @param domainId The hostname to make canonical.
	 * @returns The stored hostname.
	 * @throws NotFoundException when the hostname is not in the caller's scope.
	 */
	async setPrimaryDomain(channelId: ID, domainId: ID): Promise<IChannelDomain> {
		const saved = await this.typeOrmChannelDomainRepository.manager.transaction(async (manager) => {
			const domain = await this.lockDomain(manager, domainId);

			if (!domain) {
				throw new NotFoundException(
					`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
						ChannelRegionRefusalReason.CHANNEL_DOMAIN_NOT_FOUND
					} — hostname row '${String(domainId)}' could not be found.`
				);
			}

			const siblings: ChannelDomain[] = await manager.find(ChannelDomain, {
				where: { channelId, ...this.scope }
			} as never);

			for (const sibling of siblings) {
				if (sibling.id !== domain.id && sibling.isPrimary) {
					sibling.isPrimary = false;
					await manager.save(ChannelDomain, sibling);
				}
			}

			domain.isPrimary = true;

			return manager.save(ChannelDomain, domain);
		});

		return this.findDomainOrFail(saved.id);
	}

	/**
	 * Withdraws a hostname from a channel.
	 *
	 * The last hostname of a channel is refused, because a channel nobody can reach cannot serve and the
	 * invariant I-25 states exactly that. A caller that means it states `force` and accepts the
	 * consequence: the channel keeps its status and its rows, and no request resolves to it until another
	 * hostname is bound.
	 *
	 * @param id The hostname row to withdraw.
	 * @param options `force` permits removing the channel's last hostname.
	 * @returns The removed hostname row, as it was stored.
	 * @throws BadRequestException when it is the channel's last hostname and `force` was not stated.
	 * @throws NotFoundException when the hostname is not in the caller's scope.
	 */
	async unbindDomain(id: ID, options: { force?: boolean } = {}): Promise<IChannelDomain> {
		const domain = await this.findDomainOrFail(id);
		const siblings = await this.listDomains(domain.channelId);

		if (siblings.length <= 1 && !options.force) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_SETUP_INCOMPLETE
				} — '${domain.hostname}' is the only hostname of channel '${String(
					domain.channelId
				)}', and a channel with no hostname cannot serve a request; bind another host first, or force the removal and accept that the channel is unreachable.`
			);
		}

		await this.softDelete(id);

		return domain;
	}

	/**
	 * Refuses a channel that no request can resolve to — invariant I-25.
	 *
	 * Read as a statement about behaviour: a channel serves requests only if an incoming `Host` header
	 * can resolve to it, and the hostname table is the only thing that answers that question. The channel's
	 * activation runs this check, which is why it lives here rather than in the channel service: the
	 * answer is a read of this service's own table.
	 *
	 * @param channelId The channel about to serve.
	 * @throws BadRequestException when the channel carries no hostname.
	 */
	async assertServable(channelId: ID): Promise<void> {
		const domains = await this.listDomains(channelId);

		if (!domains.length) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_SETUP_INCOMPLETE
				} — channel '${String(channelId)}' carries no hostname, so no request can resolve to it; bind one before the channel serves.`
			);
		}
	}

	/**
	 * Reduces a host to the single form the column stores, and refuses anything that is not one.
	 *
	 * One normaliser for the write path and the lookup path, deliberately: a row stored with the
	 * caller's own spelling would resolve for that caller and for nobody else. The scheme, the path, the
	 * query, the fragment, the port, a trailing dot and the case are all removed because none of them
	 * distinguishes two hosts, and a value that still does not look like a hostname afterwards is
	 * refused rather than stored.
	 *
	 * @param hostname The host as the caller or the request presented it.
	 * @param strict When false an unusable value answers `''` instead of raising, which is what the
	 * resolution path wants: a request with a nonsense header resolves to no channel rather than failing
	 * the whole request.
	 * @returns The normalised hostname.
	 * @throws BadRequestException when the value is absent or is not a hostname, and `strict` is true.
	 */
	normaliseHostname(hostname?: string, strict = true): string {
		const raw = hostname ? String(hostname).trim().toLowerCase() : '';
		const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
		const hostOnly = withoutScheme.split(/[/?#]/)[0].split('@').pop() ?? '';
		const withoutPort = hostOnly.replace(/:\d+$/, '');
		const normalised = withoutPort.replace(/\.+$/, '');
		const looksLikeHost = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(normalised);

		if (!normalised || !looksLikeHost) {
			if (!strict) {
				return '';
			}

			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: ${
					ChannelRegionRefusalReason.CHANNEL_DOMAIN_HOSTNAME_INVALID
				} — '${String(hostname ?? '')}' is not a hostname; a channel domain is the host alone, lower-cased, without a scheme and without a path.`
			);
		}

		return normalised;
	}

	/**
	 * Finds the live row that already owns a hostname, anywhere in the deployment.
	 *
	 * Not scoped by organization, because the header is not: the row that owns the hostname is the row
	 * that would answer for it, whichever tenant wrote it.
	 *
	 * @param hostname The normalised hostname.
	 * @returns The row that owns it, or null.
	 */
	private async findByHostname(hostname: string): Promise<ChannelDomain | null> {
		const bound = await this.typeOrmChannelDomainRepository.findOne({
			where: { hostname, deletedAt: null } as never
		});

		return bound ?? null;
	}

	/**
	 * Reads a hostname row under a lock where the dialect supports one.
	 *
	 * The primary rule is decided from the flag's current holder, so the row is held for the decision
	 * rather than read and written around. The embedded dialect serializes writers on its own, so there
	 * the surrounding transaction is the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param id The hostname row to lock.
	 * @returns The locked row, or null when it does not exist.
	 */
	private async lockDomain(manager: EntityManager, id: ID): Promise<ChannelDomain | null> {
		const query = manager.createQueryBuilder(ChannelDomain, 'domain').where({ id, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}
}
