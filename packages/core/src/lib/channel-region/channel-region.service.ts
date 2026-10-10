import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ChannelRegionRefusalReason,
	IChannelRegion,
	IChannelRegionInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { RegionService } from '../region/region.service';
import { Channel } from '../channel/channel.entity';
import { TypeOrmChannelRepository } from '../channel/repository/type-orm-channel.repository';
import { ChannelRegion } from './channel-region.entity';
import { TypeOrmChannelRegionRepository } from './repository/type-orm-channel-region.repository';
import { MikroOrmChannelRegionRepository } from './repository/mikro-orm-channel-region.repository';

/**
 * Which regions a channel may sell into.
 *
 * **A region is reachable from a channel only through a row here.** The channel-scope guard resolves a
 * channel from the request, and everything the channel then offers — its currency, its tax-inclusivity,
 * its providers — is resolved per region; a region that is not published to the channel is simply not
 * one of the channel's, and the platform says so with `REGION_NOT_SUPPORTED_FOR_CHANNEL` rather than
 * falling back to another region. A cart priced in the wrong geography is a wrong tax total, not a wrong
 * label.
 *
 * **Three rules this service owns.**
 *
 * 1. **One row per pair among live rows.** The partial unique index states it and this service refuses
 *    the duplicate before the database has to; the dialect that has no filtered index gets the generated
 *    key column form from the migration, and the rule is the same rule.
 * 2. **At most one fallback region per channel.** The flag the spec calls `isDefault` is the region the
 *    channel uses when its own `defaultRegionId` is unset, so claiming it releases the previous holder
 *    in the same transaction — an index can state "at most one" and cannot *move* it.
 * 3. **The channel's own default region is a member, and stays one (invariant I-27).** Naming a region
 *    as the channel's default requires the row to exist here — that check is run by the channel service,
 *    which writes the column — and this service refuses to withdraw the row while the channel still
 *    names it. Between them, the two writes cannot disagree, which is the state the schema chapter says
 *    must be impossible.
 *
 * The channel table is read through its repository rather than through the channel service, so the two
 * services do not depend on each other and no import cycle is created between the two directories.
 */
@Injectable()
export class ChannelRegionService extends TenantAwareCrudService<ChannelRegion> {
	constructor(
		readonly typeOrmChannelRegionRepository: TypeOrmChannelRegionRepository,
		readonly mikroOrmChannelRegionRepository: MikroOrmChannelRegionRepository,
		/**
		 * The region service, for the check every publication needs: the region has to be in the caller's
		 * scope before it is published to anything.
		 */
		private readonly regionService: RegionService,
		/** The channel table, read for the I-27 guard that keeps the two default writes consistent. */
		private readonly typeOrmChannelRepository: TypeOrmChannelRepository
	) {
		super(typeOrmChannelRegionRepository, mikroOrmChannelRegionRepository);
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
	 * Publishes a region to a channel: the pivot's own membership operation.
	 *
	 * Both peers are resolved first, so a membership cannot be written against a channel or a region of
	 * another organization; the pair is then probed, so a duplicate is refused by name rather than by a
	 * driver's message. `isDefault` claims the channel's fallback flag, which releases it from the holder
	 * in the same transaction.
	 *
	 * @param channelId The channel the region is published to.
	 * @param regionId The region to publish.
	 * @param options `isDefault` marks the row as the channel's fallback region.
	 * @returns The stored membership.
	 * @throws BadRequestException when the region is already published to the channel.
	 * @throws NotFoundException when the channel or the region is not in the caller's scope.
	 */
	async publishRegion(
		channelId: ID,
		regionId: ID,
		options: { isDefault?: boolean } = {}
	): Promise<IChannelRegion> {
		await this.assertChannelExists(channelId);
		await this.regionService.findRegionOrFail(regionId);

		if (await this.findMembership(channelId, regionId)) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: ${
					ChannelRegionRefusalReason.CHANNEL_REGION_EXISTS
				} — region '${String(regionId)}' is already published to channel '${String(channelId)}'.`
			);
		}

		const membership = await this.create({
			channelId,
			regionId,
			isDefault: options.isDefault ?? false,
			...this.scope
		} as never);

		if (options.isDefault) {
			await this.setDefaultRegion(channelId, regionId);
		}

		return membership;
	}

	/**
	 * Replaces a channel's region set in one transaction.
	 *
	 * The operation the administration surface offers, and deliberately a **set**: the memberships the
	 * caller states are published, the ones it leaves out are withdrawn, and at most one member may claim
	 * the fallback flag. A member the channel still names as its default region cannot be withdrawn by
	 * the replacement — the caller has to stop naming it first — because the two writes disagreeing is
	 * exactly what invariant I-27 forbids.
	 *
	 * @param channelId The channel whose set is replaced.
	 * @param regions The regions the channel sells into afterwards.
	 * @returns The stored membership rows.
	 * @throws BadRequestException when two members name the same region, or two claim the fallback flag.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async replaceRegions(channelId: ID, regions: IChannelRegionInput[]): Promise<IChannelRegion[]> {
		await this.assertChannelExists(channelId);

		const members = regions ?? [];
		const seen = new Set<ID>();
		let defaults = 0;

		for (const member of members) {
			if (!member?.regionId) {
				throw new BadRequestException(
					`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: every member of a channel's region set names a region, and one did not.`
				);
			}

			if (seen.has(member.regionId)) {
				throw new BadRequestException(
					`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: ${
						ChannelRegionRefusalReason.CHANNEL_REGION_EXISTS
					} — region '${String(member.regionId)}' is stated twice in one region set, and a region is published to a channel once.`
				);
			}

			seen.add(member.regionId);

			if (member.isDefault) {
				defaults++;
			}
		}

		if (defaults > 1) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: a channel has at most one fallback region, and ${defaults} were stated.`
			);
		}

		await this.typeOrmChannelRegionRepository.manager.transaction(async (manager) => {
			const channel = await manager.findOne(Channel, { where: { id: channelId, ...this.scope } } as never);
			const current: ChannelRegion[] = await manager.find(ChannelRegion, {
				where: { channelId, ...this.scope }
			} as never);

			for (const row of current) {
				if (!seen.has(row.regionId)) {
					if (channel?.defaultRegionId === row.regionId) {
						throw new BadRequestException(
							`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
								ChannelRegionRefusalReason.CHANNEL_DEFAULT_REGION_PUBLISHED
							} — region '${String(
								row.regionId
							)}' is the channel's default region, so it is not withdrawn from the channel's region set; clear the channel's default region first.`
						);
					}

					row.deletedAt = new Date();
					await manager.save(ChannelRegion, row);
				}
			}

			for (const member of members) {
				const row = current.find((one) => one.regionId === member.regionId);

				if (row) {
					row.isDefault = member.isDefault ?? false;
					row.deletedAt = undefined;
					await manager.save(ChannelRegion, row);
				} else {
					await manager.save(ChannelRegion, {
						channelId,
						regionId: member.regionId,
						isDefault: member.isDefault ?? false,
						...this.scope
					} as never);
				}
			}
		});

		return this.listRegions(channelId);
	}

	/**
	 * The regions published to a channel.
	 *
	 * @param channelId The channel.
	 * @returns The membership rows, fallback region first.
	 */
	async listRegions(channelId: ID): Promise<IChannelRegion[]> {
		const rows: ChannelRegion[] = await this.find({ where: { channelId, ...this.scope } } as never);

		return (rows ?? []).slice().sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
	}

	/**
	 * The membership row of one pair, when the channel offers the region.
	 *
	 * @param channelId The channel.
	 * @param regionId The region.
	 * @returns The membership, or null.
	 */
	async findMembership(channelId: ID, regionId: ID): Promise<IChannelRegion | null> {
		const rows: ChannelRegion[] = await this.find({
			where: { channelId, regionId, ...this.scope }
		} as never);

		return rows.length ? rows[0] : null;
	}

	/**
	 * Whether a channel offers a region.
	 *
	 * @param channelId The channel.
	 * @param regionId The region.
	 * @returns True when a live membership row exists for the pair.
	 */
	async isRegionEnabled(channelId: ID, regionId: ID): Promise<boolean> {
		return Boolean(await this.findMembership(channelId, regionId));
	}

	/**
	 * Refuses a region a channel does not offer.
	 *
	 * The check a channel-scoped request runs when its derived context names a region: the region has to
	 * be one of the channel's, and a region that is merely in the same organization is not.
	 *
	 * @param channelId The channel.
	 * @param regionId The region.
	 * @throws BadRequestException when the region is not published to the channel.
	 */
	async assertRegionEnabled(channelId: ID, regionId: ID): Promise<void> {
		if (await this.isRegionEnabled(channelId, regionId)) {
			return;
		}

		throw new BadRequestException(
			`${ApiErrorCode.VALIDATION_FAILED}: ${
				ChannelRegionRefusalReason.REGION_NOT_SUPPORTED_FOR_CHANNEL
			} — region '${String(regionId)}' is not enabled for channel '${String(channelId)}'.`
		);
	}

	/**
	 * Marks the region a channel falls back to, releasing the flag from the current holder.
	 *
	 * The row has to exist — a region that is not published to the channel cannot be its fallback — and
	 * the two writes happen in one transaction so that a channel is never left with two fallbacks, which
	 * is the state the partial unique index would reject at commit time.
	 *
	 * @param channelId The channel.
	 * @param regionId The region.
	 * @returns The stored membership.
	 * @throws BadRequestException when the region is not published to the channel.
	 * @throws NotFoundException when the channel is not in the caller's scope.
	 */
	async setDefaultRegion(channelId: ID, regionId: ID): Promise<IChannelRegion> {
		await this.assertChannelExists(channelId);

		const saved = await this.typeOrmChannelRegionRepository.manager.transaction(async (manager) => {
			const membership = await this.lockMembership(manager, channelId, regionId);

			if (!membership) {
				throw new BadRequestException(
					`${ApiErrorCode.VALIDATION_FAILED}: ${
						ChannelRegionRefusalReason.REGION_NOT_SUPPORTED_FOR_CHANNEL
					} — region '${String(regionId)}' is not enabled for channel '${String(
						channelId
					)}', so it cannot be the region the channel falls back to.`
				);
			}

			const siblings: ChannelRegion[] = await manager.find(ChannelRegion, {
				where: { channelId, ...this.scope }
			} as never);

			for (const sibling of siblings) {
				if (sibling.id !== membership.id && sibling.isDefault) {
					sibling.isDefault = false;
					await manager.save(ChannelRegion, sibling);
				}
			}

			membership.isDefault = true;

			return manager.save(ChannelRegion, membership);
		});

		return this.findOneOrFail(saved);
	}

	/**
	 * Withdraws a region from a channel.
	 *
	 * Refused while the channel still names the region as its default, because the schema chapter's
	 * invariant I-27 states that the channel's `defaultRegionId`, when set, also has a row here — the two
	 * writes disagreeing is the state the check exists to make impossible. The caller clears the channel's
	 * default region first, which is an explicit operation with its own name.
	 *
	 * @param channelId The channel.
	 * @param regionId The region to withdraw.
	 * @throws BadRequestException when the region is the channel's default region.
	 * @throws NotFoundException when the region is not published to the channel.
	 */
	async unpublishRegion(channelId: ID, regionId: ID): Promise<void> {
		const membership = await this.findMembership(channelId, regionId);

		if (!membership) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
					ChannelRegionRefusalReason.REGION_NOT_SUPPORTED_FOR_CHANNEL
				} — region '${String(regionId)}' is not enabled for channel '${String(channelId)}'.`
			);
		}

		const channel = await this.typeOrmChannelRepository.findOne({
			where: { id: channelId, ...this.scope }
		} as never);

		if (channel?.defaultRegionId === regionId) {
			throw new BadRequestException(
				`${ApiErrorCode.PRECONDITION_REQUIRED}: ${
					ChannelRegionRefusalReason.CHANNEL_DEFAULT_REGION_PUBLISHED
				} — region '${String(regionId)}' is the default region of channel '${String(
					channelId
				)}', so it is not withdrawn while the channel names it; clear the channel's default region first.`
			);
		}

		await this.softDelete(membership.id);
	}

	/**
	 * Refuses a channel that is not in the caller's scope.
	 *
	 * The channel is read through its own repository rather than through the channel service, so the two
	 * services stay independent; the row's tenancy is the caller's, which is why the scope is part of the
	 * probe and not only of the identifier.
	 *
	 * @param channelId The channel.
	 * @throws NotFoundException when the channel does not exist inside the caller's scope.
	 */
	private async assertChannelExists(channelId: ID): Promise<void> {
		const channel = await this.typeOrmChannelRepository.findOne({
			where: { id: channelId, ...this.scope }
		} as never);

		if (!channel) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
					ChannelRegionRefusalReason.CHANNEL_NOT_FOUND
				} — channel '${String(channelId)}' could not be found.`
			);
		}
	}

	/**
	 * Loads a membership row that a write has just stored.
	 *
	 * @param membership The row the transaction saved.
	 * @returns The stored row, read back through the service's own scope.
	 * @throws NotFoundException when the row is no longer visible.
	 */
	private async findOneOrFail(membership: IChannelRegion): Promise<IChannelRegion> {
		const stored = await this.findMembership(membership.channelId, membership.regionId);

		if (!stored) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
					ChannelRegionRefusalReason.REGION_NOT_SUPPORTED_FOR_CHANNEL
				} — the membership that was just written could not be read back.`
			);
		}

		return stored;
	}

	/**
	 * Reads a membership row under a lock where the dialect supports one.
	 *
	 * The fallback rule is decided from the flag's current holder, so the row is held for the decision
	 * rather than read and written around. The embedded dialect serializes writers on its own, so there
	 * the surrounding transaction is the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param channelId The channel.
	 * @param regionId The region.
	 * @returns The locked membership, or null when the pair is not published.
	 */
	private async lockMembership(manager: EntityManager, channelId: ID, regionId: ID): Promise<ChannelRegion | null> {
		const query = manager
			.createQueryBuilder(ChannelRegion, 'membership')
			.where({ channelId, regionId, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}
}
