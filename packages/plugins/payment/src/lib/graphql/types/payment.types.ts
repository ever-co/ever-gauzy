import { Between } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	IPaymentCapture,
	IPaymentCollection,
	IPaymentProvider,
	IPaymentSession,
	IPaymentWebhookEvent,
	IRefund,
	IRefundLine,
	IRefundReason
} from '../../payment.types';
import { IConnection, IResourcePayload } from './connection';

/**
 * The shapes the payment resolvers read and answer with.
 *
 * Two of them are per connection. A **filter** mirrors the read the domain actually serves — the
 * members a caller may narrow on, named after the column they narrow — and a **sort** names the
 * orderings the SDL declares, so a client that asks for an order the connection does not declare is
 * refused by the schema rather than by the database. A filter with a range carries the two members
 * the SDL declares for it (`capturedAtFrom` / `capturedAtTo`), which are translated here into the
 * comparison a repository understands, because `capturedAt` is one column and a range is two
 * arguments.
 *
 * The payload aliases exist so a resolver's return type names the mutation it serves, rather than
 * `IMutationPayload<IPaymentSession>` repeated in seven signatures, and so the member the SDL gives the
 * resource — `paymentSession`, `refund` — is stated once rather than repeated in every signature.
 */

/**
 * The ordering a connection understands, exactly as the SDL declares it.
 */
export interface IPaymentSort {
	readonly field: string;
	readonly direction?: string;
}

/**
 * The sortable fields of each connection, mapped from the SDL's name to the column's name.
 */
export const PAYMENT_PROVIDER_SORT_FIELDS: Record<string, string> = {
	CODE: 'code',
	NAME: 'name',
	SORT_ORDER: 'sortOrder',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const PAYMENT_COLLECTION_SORT_FIELDS: Record<string, string> = {
	AMOUNT: 'amount',
	STATUS: 'status',
	CAPTURED_AT: 'completedAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const PAYMENT_SESSION_SORT_FIELDS: Record<string, string> = {
	AMOUNT: 'amount',
	STATUS: 'status',
	EXPIRES_AT: 'expiresAt',
	AUTHORIZED_AT: 'authorizedAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const PAYMENT_CAPTURE_SORT_FIELDS: Record<string, string> = {
	AMOUNT: 'amount',
	CAPTURED_AT: 'capturedAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const REFUND_SORT_FIELDS: Record<string, string> = {
	AMOUNT: 'amount',
	STATUS: 'status',
	REFUNDED_AT: 'refundedAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const REFUND_REASON_SORT_FIELDS: Record<string, string> = {
	CODE: 'code',
	LABEL: 'label',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const REFUND_LINE_SORT_FIELDS: Record<string, string> = {
	ORDER_LINE_ID: 'orderLineId',
	QUANTITY: 'quantity',
	AMOUNT: 'amount',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

export const PAYMENT_WEBHOOK_EVENT_SORT_FIELDS: Record<string, string> = {
	TYPE: 'type',
	STATUS: 'status',
	RECEIVED_AT: 'receivedAt',
	PROCESSED_AT: 'processedAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * A provider filter.
 */
export interface IPaymentProviderFilter {
	readonly id?: ID;
	readonly code?: string;
	readonly isEnabled?: boolean;
	readonly isTestMode?: boolean;
	readonly integrationId?: ID;
}

/**
 * A collection filter.
 */
export interface IPaymentCollectionFilter {
	readonly id?: ID;
	readonly orderId?: ID;
	readonly cartId?: ID;
	readonly status?: string;
	readonly currency?: string;
}

/**
 * A session filter.
 */
export interface IPaymentSessionFilter {
	readonly id?: ID;
	readonly collectionId?: ID;
	readonly providerId?: ID;
	readonly status?: string;
	readonly externalId?: string;
	readonly paymentMethodTokenId?: ID;
}

/**
 * A capture filter.
 */
export interface IPaymentCaptureFilter {
	readonly id?: ID;
	readonly paymentId?: ID;
	readonly externalId?: string;
	readonly capturedAtFrom?: Date;
	readonly capturedAtTo?: Date;
}

/**
 * A refund filter.
 */
export interface IRefundFilter {
	readonly id?: ID;
	readonly orderId?: ID;
	readonly paymentId?: ID;
	readonly returnId?: ID;
	readonly claimId?: ID;
	readonly reasonId?: ID;
	readonly status?: string;
}

/**
 * A refund-reason filter.
 */
export interface IRefundReasonFilter {
	readonly id?: ID;
	readonly code?: string;
	readonly parentId?: ID;
	readonly isActive?: boolean;
}

/**
 * A refund-line filter.
 */
export interface IRefundLineFilter {
	readonly id?: ID;
	readonly refundId?: ID;
	readonly orderLineId?: ID;
	readonly currency?: string;
}

/**
 * A callback filter.
 */
export interface IPaymentWebhookEventFilter {
	readonly id?: ID;
	readonly providerId?: ID;
	readonly eventId?: string;
	readonly type?: string;
	readonly status?: string;
	readonly receivedAtFrom?: Date;
	readonly receivedAtTo?: Date;
}

/**
 * The create and update inputs of a provider, as the SDL declares them.
 */
export interface ICreatePaymentProviderGraphInput {
	readonly code: string;
	readonly name: string;
	readonly isEnabled?: boolean;
	readonly isTestMode?: boolean;
	readonly integrationId?: ID;
	readonly supportedCurrencies?: string[];
	readonly supportedCountries?: string[];
	readonly supportedPaymentMethods?: string[];
	readonly sortOrder?: number;
	readonly configuration?: Record<string, unknown>;
	readonly metadata?: Record<string, unknown>;
	readonly idempotencyKey?: string;
}

export interface IUpdatePaymentProviderGraphInput extends Partial<ICreatePaymentProviderGraphInput> {
	readonly id: ID;
	readonly code?: never;
}

/**
 * The create and update inputs of a collection, as the SDL declares them.
 */
export interface ICreatePaymentCollectionGraphInput {
	readonly orderId?: ID;
	readonly cartId?: ID;
	readonly amount: string;
	readonly currency: string;
	readonly settlementCurrency?: string;
	readonly settlementAmount?: string;
	readonly fxRate?: string;
	readonly fxRateId?: ID;
	readonly fxCapturedAt?: Date;
	readonly metadata?: Record<string, unknown>;
	readonly idempotencyKey?: string;
}

export interface IUpdatePaymentCollectionGraphInput {
	readonly id: ID;
	readonly settlementCurrency?: string;
	readonly settlementAmount?: string;
	readonly fxRate?: string;
	readonly fxRateId?: ID;
	readonly fxCapturedAt?: Date;
	readonly metadata?: Record<string, unknown>;
}

/**
 * The inputs of the session lifecycle, as the SDL declares them.
 */
export interface IOpenPaymentSessionGraphInput {
	readonly collectionId: ID;
	readonly providerId?: ID;
	readonly providerCode?: string;
	readonly amount: string;
	readonly currency?: string;
	readonly paymentMethod?: string;
	readonly data?: Record<string, unknown>;
	readonly paymentMethodTokenId?: ID;
	readonly idempotencyKey?: string;
	readonly expiresAt?: Date;
}

/**
 * The authorisation of an attempt, as the SDL declares it. The amount is advisory: the attempt already
 * carries the amount the provider was asked for, and the service refuses one that does not match
 * rather than silently authorising a different figure.
 */
export interface IAuthorizePaymentSessionGraphInput {
	readonly id: ID;
	readonly amount?: string;
	readonly data?: Record<string, unknown>;
	readonly idempotencyKey?: string;
}

/**
 * The voiding of an attempt, as the SDL declares it.
 */
export interface IVoidPaymentSessionGraphInput {
	readonly id: ID;
	readonly reason?: string;
}

/**
 * The capture input, as the SDL declares it.
 */
export interface ICapturePaymentGraphInput {
	readonly paymentId: ID;
	readonly amount: string;
	readonly currency?: string;
	readonly externalId?: string;
	readonly capturedAt?: Date;
	readonly finalize?: boolean;
	readonly metadata?: Record<string, unknown>;
	readonly idempotencyKey?: string;
}

/**
 * The refund inputs, as the SDL declares them.
 */
export interface ICreateRefundGraphInput {
	readonly orderId: ID;
	readonly paymentId?: ID;
	readonly returnId?: ID;
	readonly claimId?: ID;
	readonly amount: string;
	readonly currency: string;
	readonly reasonId?: ID;
	readonly reason?: string;
	readonly note?: string;
	readonly storeCredit?: boolean;
	readonly metadata?: Record<string, unknown>;
	readonly lines?: IRefundLineGraphInput[];
	readonly idempotencyKey?: string;
}

/**
 * The descriptive fields of a refund an update may change, as the SDL declares them. The amount, the
 * currency and the status are not among them: an amount is what the refund is, and the status moves
 * through approval.
 */
export interface IUpdateRefundGraphInput {
	readonly id: ID;
	readonly reasonId?: ID;
	readonly reason?: string;
	readonly note?: string;
	readonly metadata?: Record<string, unknown>;
}

/**
 * The approval of a refund, as the SDL declares it.
 */
export interface IApproveRefundGraphInput {
	readonly id: ID;
	readonly note?: string;
	readonly idempotencyKey?: string;
}

/**
 * The withdrawal of a refund, as the SDL declares it.
 */
export interface ICancelRefundGraphInput {
	readonly id: ID;
	readonly reason?: string;
}

/**
 * One line of a refund request, as the SDL declares it: what came back, and for how much. The currency
 * is the refund's, and a request that names a different one is refused rather than converted.
 */
export interface IRefundLineGraphInput {
	readonly orderLineId: ID;
	readonly quantity: string;
	readonly amount: string;
	readonly currency?: string;
	readonly metadata?: Record<string, unknown>;
}

/**
 * The refund-line inputs, as the SDL declares them. The create input states its refund, because a line
 * recorded on its own has to say which refund it accounts for.
 */
export interface ICreateRefundLineGraphInput extends IRefundLineGraphInput {
	readonly refundId: ID;
	readonly idempotencyKey?: string;
}

/**
 * What a line of a pending refund may change: its quantity, its amount and its metadata. What the line
 * explains — its refund and its order line — is not among them.
 */
export interface IUpdateRefundLineGraphInput {
	readonly id: ID;
	readonly quantity?: string;
	readonly amount?: string;
	readonly currency?: string;
	readonly metadata?: Record<string, unknown>;
}

/**
 * The replay of a stored callback, as the SDL declares it.
 */
export interface IReprocessPaymentWebhookEventGraphInput {
	readonly id: ID;
	readonly force?: boolean;
	readonly idempotencyKey?: string;
}

/**
 * The refund-reason inputs, as the SDL declares them.
 */
export interface ICreateRefundReasonGraphInput {
	readonly code: string;
	readonly label: string;
	readonly description?: string;
	readonly parentId?: ID;
	readonly idempotencyKey?: string;
}

export interface IUpdateRefundReasonGraphInput {
	readonly id: ID;
	readonly label?: string;
	readonly description?: string;
	readonly parentId?: ID;
	readonly isActive?: boolean;
}

/**
 * A page of provider registrations.
 */
export type IPaymentProviderConnection = IConnection<IPaymentProvider>;

/**
 * A page of collections.
 */
export type IPaymentCollectionConnection = IConnection<IPaymentCollection>;

/**
 * A page of sessions.
 */
export type IPaymentSessionConnection = IConnection<IPaymentSession>;

/**
 * A page of captures.
 */
export type IPaymentCaptureConnection = IConnection<IPaymentCapture>;

/**
 * A page of refunds.
 */
export type IRefundConnection = IConnection<IRefund>;

/**
 * A page of refund reasons.
 */
export type IRefundReasonConnection = IConnection<IRefundReason>;

/**
 * A page of refund lines.
 */
export type IRefundLineConnection = IConnection<IRefundLine>;

/**
 * A page of inbound callbacks.
 */
export type IPaymentWebhookEventConnection = IConnection<IPaymentWebhookEvent>;

/**
 * The answer of a provider mutation.
 */
export type ICreatePaymentProviderPayload = IResourcePayload<IPaymentProvider, 'paymentProvider'>;

/**
 * The answer of a provider update.
 */
export type IUpdatePaymentProviderPayload = IResourcePayload<IPaymentProvider, 'paymentProvider'>;

/**
 * The answer of a provider deletion.
 */
export type IDeletePaymentProviderPayload = IResourcePayload<IPaymentProvider, 'paymentProvider'> & {
	readonly deleted: boolean;
};

/**
 * The answer of a collection mutation.
 */
export type ICreatePaymentCollectionPayload = IResourcePayload<IPaymentCollection, 'paymentCollection'>;

/**
 * The answer of a collection update.
 */
export type IUpdatePaymentCollectionPayload = IResourcePayload<IPaymentCollection, 'paymentCollection'>;

/**
 * The answer of a session creation.
 */
export type IOpenPaymentSessionPayload = IResourcePayload<IPaymentSession, 'paymentSession'>;

/**
 * The answer of a session authorisation.
 */
export type IAuthorizePaymentSessionPayload = IResourcePayload<IPaymentSession, 'paymentSession'>;

/**
 * The answer of a session cancellation.
 */
export type IVoidPaymentSessionPayload = IResourcePayload<IPaymentSession, 'paymentSession'>;

/**
 * The answer of a capture.
 */
export type ICapturePaymentPayload = IResourcePayload<IPaymentCapture, 'paymentCapture'>;

/**
 * The answer of a refund creation.
 */
export type ICreateRefundPayload = IResourcePayload<IRefund, 'refund'>;

/**
 * The answer of a refund update.
 */
export type IUpdateRefundPayload = IResourcePayload<IRefund, 'refund'>;

/**
 * The answer of a refund approval.
 */
export type IApproveRefundPayload = IResourcePayload<IRefund, 'refund'>;

/**
 * The answer of a refund cancellation.
 */
export type ICancelRefundPayload = IResourcePayload<IRefund, 'refund'>;

/**
 * The answer of a refund reason creation.
 */
export type ICreateRefundReasonPayload = IResourcePayload<IRefundReason, 'refundReason'>;

/**
 * The answer of a refund reason update.
 */
export type IUpdateRefundReasonPayload = IResourcePayload<IRefundReason, 'refundReason'>;

/**
 * The answer of a refund reason deletion. A reason is deactivated rather than removed, so `deleted`
 * reports that the reason is out of the catalogue — not that its row is gone.
 */
export type IDeleteRefundReasonPayload = IResourcePayload<IRefundReason, 'refundReason'> & {
	readonly deleted: boolean;
};

/**
 * The answer of a refund-line creation.
 */
export type ICreateRefundLinePayload = IResourcePayload<IRefundLine, 'refundLine'>;

/**
 * The answer of a refund-line update.
 */
export type IUpdateRefundLinePayload = IResourcePayload<IRefundLine, 'refundLine'>;

/**
 * The answer of a refund-line removal. A line is soft-deleted like every other row of this platform,
 * so `deleted` reports that the line no longer counts towards its refund — the live pair it occupied
 * is free again.
 */
export type IDeleteRefundLinePayload = IResourcePayload<IRefundLine, 'refundLine'> & {
	readonly deleted: boolean;
};

/**
 * The answer of a callback re-run.
 */
export type IReprocessPaymentWebhookEventPayload = IResourcePayload<
	IPaymentWebhookEvent,
	'paymentWebhookEvent'
>;

/**
 * Separates the range members of a filter from the equality members.
 *
 * `capturedAtFrom` and `capturedAtTo` are two arguments that describe one column, and passing them
 * through as members of an equality filter would ask the database for a row whose `capturedAt` equals
 * the string `"capturedAtFrom"`. They are therefore lifted out here and folded into a comparison, and
 * the caller is left with the members that really are equalities.
 *
 * @param filter The filter the caller sent.
 * @param rangeKeys The members that are part of a range.
 * @returns The equality members of the filter.
 */
export function withoutRange(filter: Record<string, unknown> = {}, rangeKeys: string[] = []): Record<string, unknown> {
	return Object.entries(filter).reduce<Record<string, unknown>>((where, [key, value]) => {
		if (!rangeKeys.includes(key) && value !== undefined && value !== null) {
			where[key] = value;
		}

		return where;
	}, {});
}

/**
 * Folds a two-member date range into the comparison a repository understands.
 *
 * A missing bound is open rather than absent: a caller that asks for "captured since yesterday" gets
 * every capture from yesterday onwards, not a filter that silently matches nothing.
 *
 * @param where The equality members already collected.
 * @param filter The filter the caller sent.
 * @param column The column the range applies to.
 * @param fromKey The member holding the lower bound.
 * @param toKey The member holding the upper bound.
 * @returns The filter with the range applied.
 */
export function withDateRange(
	where: Record<string, unknown>,
	filter: Record<string, unknown> = {},
	column: string,
	fromKey: string,
	toKey: string
): Record<string, unknown> {
	const from = filter[fromKey] as Date | undefined;
	const to = filter[toKey] as Date | undefined;

	if (from || to) {
		where[column] = Between(from ?? new Date(0), to ?? new Date());
	}

	return where;
}
