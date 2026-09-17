import { Between } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	IPaymentCapture,
	IPaymentCollection,
	IPaymentProvider,
	IPaymentSession,
	IPaymentWebhookEvent,
	IRefund,
	IRefundReason
} from '../../payment.types';
import { IConnection, IMutationPayload } from './connection';

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
 * `IMutationPayload<IPaymentSession>` repeated in seven signatures.
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
 * A page of inbound callbacks.
 */
export type IPaymentWebhookEventConnection = IConnection<IPaymentWebhookEvent>;

/**
 * The answer of a provider mutation.
 */
export type ICreatePaymentProviderPayload = IMutationPayload<IPaymentProvider>;

/**
 * The answer of a provider update.
 */
export type IUpdatePaymentProviderPayload = IMutationPayload<IPaymentProvider>;

/**
 * The answer of a provider deletion.
 */
export type IDeletePaymentProviderPayload = IMutationPayload<IPaymentProvider>;

/**
 * The answer of a collection mutation.
 */
export type ICreatePaymentCollectionPayload = IMutationPayload<IPaymentCollection>;

/**
 * The answer of a collection update.
 */
export type IUpdatePaymentCollectionPayload = IMutationPayload<IPaymentCollection>;

/**
 * The answer of a session creation.
 */
export type IOpenPaymentSessionPayload = IMutationPayload<IPaymentSession>;

/**
 * The answer of a session authorisation.
 */
export type IAuthorizePaymentSessionPayload = IMutationPayload<IPaymentSession>;

/**
 * The answer of a session cancellation.
 */
export type IVoidPaymentSessionPayload = IMutationPayload<IPaymentSession>;

/**
 * The answer of a capture.
 */
export type ICapturePaymentPayload = IMutationPayload<IPaymentCapture>;

/**
 * The answer of a refund creation.
 */
export type ICreateRefundPayload = IMutationPayload<IRefund>;

/**
 * The answer of a refund approval or cancellation.
 */
export type IApproveRefundPayload = IMutationPayload<IRefund>;

/**
 * The answer of a refund reason creation.
 */
export type ICreateRefundReasonPayload = IMutationPayload<IRefundReason>;

/**
 * The answer of a refund reason update.
 */
export type IUpdateRefundReasonPayload = IMutationPayload<IRefundReason>;

/**
 * The answer of a refund reason deletion.
 */
export type IDeleteRefundReasonPayload = IMutationPayload<IRefundReason>;

/**
 * The answer of a callback re-run.
 */
export type IReprocessPaymentWebhookEventPayload = IMutationPayload<IPaymentWebhookEvent>;

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
