/**
 * Published whenever a level row changes.
 *
 * The event carries the derived availability rather than the raw row, because that is the number
 * every consumer actually wants and recomputing it in each of them is how two of them end up
 * disagreeing. The three level states are separate classes so a subscriber declares which one it
 * cares about instead of filtering on a field.
 */
import { BaseEvent } from '@gauzy/core';
import { IStockAvailability } from './../stock-level/stock-level.types';

/** A level row changed; the payload is the availability it now reports. */
export class InventoryLevelChangedEvent extends BaseEvent {
	constructor(public readonly level: IStockAvailability) {
		super();
	}
}

/** A level row crossed into a low state. */
export class InventoryLevelLowEvent extends InventoryLevelChangedEvent {}

/** A level row reached zero availability. */
export class InventoryLevelOutOfStockEvent extends InventoryLevelChangedEvent {}
