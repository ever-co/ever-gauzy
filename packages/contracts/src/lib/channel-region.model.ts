import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IChannel } from './channel.model';
import { IRegion } from './region.model';

/**
 * The publication of one region to one channel.
 *
 * A pivot row and nothing more: it has no meaning without either peer, which is why both of its
 * references cascade and why it carries no lifecycle of its own. Publishing a region to a channel is
 * what makes the region's currency, tax-inclusivity and provider selection reachable from a request
 * that resolved that channel; a region that is not published here is not offered by the channel, and
 * the platform says so with `REGION_NOT_SUPPORTED_FOR_CHANNEL` rather than falling back to another
 * region. `isDefault` marks the region a channel falls back to when the channel names no default
 * region of its own, and at most one row per channel carries it.
 */
export interface IChannelRegion extends IBasePerTenantAndOrganizationEntityModel {
	/** The channel the region is published to. */
	channelId: ID;
	/** The channel row `channelId` names. */
	channel?: IChannel;
	/** The region that is published. */
	regionId: ID;
	/** The region row `regionId` names. */
	region?: IRegion;
	/** Whether this is the region the channel falls back to when its own default region is unset. */
	isDefault: boolean;
}

/**
 * One member of a channel's region set, as the whole-set replacement states it.
 *
 * The replacement is the operation the administration surface offers — a channel's regions are saved
 * as a set, not one row at a time — so the input carries both members and the flag and nothing else.
 */
export interface IChannelRegionInput {
	/** The region to publish to the channel. */
	regionId: ID;
	/** Whether this region is the channel's fallback region. At most one member of the set may carry it. */
	isDefault?: boolean;
}
