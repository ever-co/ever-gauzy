/**
 * Published on every transfer transition.
 */
import { BaseEvent } from '@gauzy/core';
import { StockTransfer } from './../stock-transfer/stock-transfer.entity';

/** A transfer changed state. */
export class StockTransferChangedEvent extends BaseEvent {
	constructor(public readonly transfer: StockTransfer) {
		super();
	}
}
