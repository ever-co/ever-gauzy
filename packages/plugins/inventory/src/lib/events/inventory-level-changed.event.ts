/**
 * Published whenever a level row changes.
 *
 * The event carries the derived availability rather than the raw row, because that is the number
 * every consumer actually wants and recomputing it in each of them is how two of them end up
 * disagreeing. The three level states are separate classes so a subscriber declares which one it
 * cares about instead of filtering on a field.
 */
import { ID } from '@gauzy/contracts';
import { BaseEvent } from '@gauzy/core';
import { IStockAvailability } from './../stock-level/stock-level.types';

/**
 * A level row changed; the payload is the availability it now reports.
 *
 * The availability names a location and a variant and nothing about whose they are, so the event states
 * the tenant and the organization beside it: a subscription delivers a level only to a subscriber of the
 * tenant the event names, and an event that names none is delivered to nobody.
 */
export class InventoryLevelChangedEvent extends BaseEvent {
	/**
	 * @param level The availability the level row now reports.
	 * @param tenantId The tenant the level row belongs to.
	 * @param organizationId The organization the level row belongs to.
	 */
	constructor(
		public readonly level: IStockAvailability,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {
		super();
	}
}

/** A level row crossed into a low state. */
export class InventoryLevelLowEvent extends InventoryLevelChangedEvent {}

/** A level row reached zero availability. */
export class InventoryLevelOutOfStockEvent extends InventoryLevelChangedEvent {}
