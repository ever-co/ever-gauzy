import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';
import { IChannel, IChannelRegion, ID, IRegion } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { Channel } from '../channel/channel.entity';
import { Region } from '../region/region.entity';
import { MikroOrmChannelRegionRepository } from './repository/mikro-orm-channel-region.repository';

/**
 * Publishes a region to a channel.
 *
 * **A pivot with one fact of its own.** Both sides are peers, so both references cascade: a publication
 * row has no meaning without its channel or without its region, and a row that survived either would be
 * a membership nothing can resolve. `isDefault` is the region the channel falls back to when the
 * channel's own `defaultRegionId` is unset or the request resolves no region; at most one live row per
 * channel carries it, which is a partial unique index on Postgres and SQLite and the documented
 * generated-key form on MySQL.
 *
 * **Membership is what makes a region reachable from a channel.** A region that is not published here is
 * not offered by the channel, and the platform says so — `REGION_NOT_SUPPORTED_FOR_CHANNEL` — rather than
 * silently falling back to another region, because a cart priced in the wrong geography is a wrong tax
 * total, not a wrong label.
 *
 * **The channel's own default region must be a member.** The invariant I-27 is a statement about two
 * tables at once, so it is enforced by the service that writes both: naming a region as the channel's
 * default requires the membership row to exist first, and withdrawing a membership that the channel
 * names as its default is refused until the channel stops naming it.
 *
 * **`tenantId` and `organizationId` are inherited and nullable**, because a membership written by the
 * kernel's own seeding names only its two peers and their tenancy is theirs.
 */
@ColumnIndex('UQ_channel_region', ['channelId', 'regionId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('UQ_channel_region_default', ['channelId'], {
	unique: true,
	where: '"isDefault" = true AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_channel_region_region', ['regionId'])
@MultiORMEntity('channel_region', { mikroOrmRepository: () => MikroOrmChannelRegionRepository })
export class ChannelRegion extends TenantOrganizationBaseEntity implements IChannelRegion {
	/**
	 * The channel the region is published to.
	 */
	@ApiProperty({ type: () => Channel })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Channel, (it) => it.regions, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	channel: IChannel;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ChannelRegion) => it.channel)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	channelId: ID;

	/**
	 * The region that is published.
	 */
	@ApiProperty({ type: () => Region })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Region, (it) => it.channels, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	region: IRegion;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ChannelRegion) => it.region)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	regionId: ID;

	/**
	 * Whether this is the region the channel falls back to.
	 *
	 * Distinct from the channel's `defaultRegionId`, which is the region a request that resolved no
	 * region is priced in: this flag is the *second* fallback, read when the channel names no default
	 * region of its own. Both are single-valued per channel, and the two are kept consistent in the
	 * direction that matters — the column may only name a region that has a row here.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;
}
