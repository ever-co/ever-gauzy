/**
 * Published whenever a hold is created, released, consumed or expired.
 */
import { BaseEvent } from '@gauzy/core';
import { StockReservation } from './../stock-reservation/stock-reservation.entity';

/** A hold changed state. */
export class StockReservationChangedEvent extends BaseEvent {
	constructor(public readonly reservation: StockReservation) {
		super();
	}
}
