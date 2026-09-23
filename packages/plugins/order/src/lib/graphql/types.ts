import { GraphqlConnection } from '@gauzy/core';
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

/**
 * A page of orders, changes, summaries or transactions.
 *
 * Each of these was a two-member shape of its own — `{ items, total }` — so the four list fields of this
 * domain were four spellings of a page and none of them could be walked from. One connection type per row
 * type, bound to the kernel's own, is what makes a client that pages orders able to page all of them.
 */
export type IOrderConnection = GraphqlConnection<Order>;
export type IOrderChangeConnection = GraphqlConnection<OrderChange>;
export type IOrderSummaryConnection = GraphqlConnection<OrderSummary>;
export type IOrderTransactionConnection = GraphqlConnection<OrderTransaction>;

/**
 * What a destructive delete of one of this domain's rows answers.
 *
 * The row is gone, so the answer cannot be the row: it is the identifier the delete named and whether a
 * row was there to remove. One shape for the whole domain rather than one per resource, because the two
 * facts are the same two whatever was removed — and it is the shape `deleteOrderLineInvoice` already
 * answers with, which is the one delete field this domain carried before these.
 */
export interface IOrderDeleteResult {
	/** The identifier the delete named. */
	id: string;
	/** Whether a row was there to remove; a delete of one that was not answers false. */
	deleted: boolean;
}
