import {
	IOrder,
	IOrderAddress,
	IOrderChange,
	IOrderChangeAction,
	IOrderCreditLine,
	IOrderHistory,
	IOrderLine,
	IOrderShippingMethod,
	IOrderSummary,
	IOrderTotals,
	IOrderTransaction
} from '@gauzy/contracts';

/**
 * The GraphQL type names of the order domain, bound to the contracts.
 *
 * The schema and the contracts describe the same rows, so they are one definition here rather than two
 * that can drift: the SDL states the shape a client sees, and these aliases state which contract a
 * resolver returns.
 */
export type Order = IOrder;
export type OrderLine = IOrderLine;
export type OrderAddress = IOrderAddress;
export type OrderShippingMethod = IOrderShippingMethod;
export type OrderSummary = IOrderSummary;
export type OrderTransaction = IOrderTransaction;
export type OrderChange = IOrderChange;
export type OrderChangeAction = IOrderChangeAction;
export type OrderCreditLine = IOrderCreditLine;
export type OrderHistory = IOrderHistory;
export type OrderTotals = IOrderTotals;

/** A page of orders. */
export interface IOrderConnection {
	items: Order[];
	total: number;
}

/** A page of order changes. */
export interface IOrderChangeConnection {
	items: OrderChange[];
	total: number;
}

/** A page of summaries. */
export interface IOrderSummaryConnection {
	items: OrderSummary[];
	total: number;
}

/** A page of transactions. */
export interface IOrderTransactionConnection {
	items: OrderTransaction[];
	total: number;
}
