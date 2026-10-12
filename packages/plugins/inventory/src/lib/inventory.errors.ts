/**
 * Error vocabulary and translation of the inventory domain.
 *
 * Every refusal names a machine code, so a caller can branch on it without parsing a message and a
 * test can assert the exact refusal instead of a substring.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Machine-readable refusal codes of the inventory domain. */
export const InventoryErrorCode = {
	CONFLICT: 'STOCK_CONFLICT',
	INVARIANT_VIOLATION: 'STOCK_INVARIANT_VIOLATION',
	INSUFFICIENT_AVAILABLE: 'STOCK_INSUFFICIENT_AVAILABLE',
	LEVEL_NOT_FOUND: 'STOCK_LEVEL_NOT_FOUND',
	LEVEL_GRANULARITY_CONFLICT: 'STOCK_LEVEL_GRANULARITY_CONFLICT',
	RESERVATION_ALREADY_CLOSED: 'RESERVATION_ALREADY_CLOSED',
	RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
	BACKORDER_NOT_ALLOWED: 'STOCK_BACKORDER_NOT_ALLOWED',
	MOVEMENT_NOT_APPENDABLE: 'STOCK_MOVEMENT_NOT_APPENDABLE',
	LOCATION_NOT_BINNED: 'LOCATION_NOT_BINNED',
	BIN_LOCATION_MISMATCH: 'BIN_LOCATION_MISMATCH',
	LOCATION_FROZEN_FOR_COUNT: 'LOCATION_FROZEN_FOR_COUNT',
	TRANSFER_SAME_LOCATION: 'STOCK_TRANSFER_SAME_LOCATION',
	TRANSFER_ILLEGAL_TRANSITION: 'STOCK_TRANSFER_ILLEGAL_TRANSITION',
	TRANSFER_OVER_RECEIPT: 'STOCK_TRANSFER_OVER_RECEIPT',
	ADJUSTMENT_ALREADY_APPLIED: 'STOCK_ADJUSTMENT_ALREADY_APPLIED',
	ADJUSTMENT_BELOW_RESERVED: 'STOCK_ADJUSTMENT_BELOW_RESERVED',
	ADJUSTMENT_REASON_REQUIRED: 'STOCK_ADJUSTMENT_REASON_REQUIRED',
	COUNT_ALREADY_OPEN: 'STOCK_COUNT_ALREADY_OPEN',
	COUNT_NOT_OPEN: 'STOCK_COUNT_NOT_OPEN',
	COUNT_ALREADY_CLOSED: 'STOCK_COUNT_ALREADY_CLOSED',
	COUNT_VARIANCE_REQUIRES_RECOUNT: 'COUNT_VARIANCE_REQUIRES_RECOUNT',
	ALERT_ALREADY_EXISTS: 'STOCK_ALERT_ALREADY_EXISTS',
	CHANNEL_DEFAULT_ALREADY_SET: 'CHANNEL_WAREHOUSE_DEFAULT_ALREADY_SET'
} as const;

/** A refusal code of the inventory domain. */
export type InventoryErrorCode = (typeof InventoryErrorCode)[keyof typeof InventoryErrorCode];

/** Details carried alongside a refusal, so a caller sees the numbers that decided it. */
export interface IInventoryErrorDetails {
	readonly invariant?: string;
	readonly level?: Record<string, unknown>;
	readonly requested?: number;
	readonly available?: number;
	readonly [key: string]: unknown;
}

/**
 * Builds the exception for a refusal code.
 *
 * Conflict is the default because the domain’s refusals are almost always a state conflict — a
 * closed reservation, a level that cannot go negative, a transfer that cannot receive more than it
 * shipped. A malformed request is the exception, and the caller passes `badRequest` for it.
 */
export function inventoryError(
	code: InventoryErrorCode,
	message: string,
	options: { details?: IInventoryErrorDetails; badRequest?: boolean; notFound?: boolean } = {}
): BadRequestException | ConflictException | NotFoundException {
	const payload = { code, message, ...(options.details ? { details: options.details } : {}) };
	if (options.notFound) {
		return new NotFoundException(payload);
	}
	if (options.badRequest) {
		return new BadRequestException(payload);
	}
	return new ConflictException(payload);
}

/** Convenience wrapper for the ledger’s invariant refusals. */
export function invariantViolation(
	invariant: string,
	message: string,
	details: IInventoryErrorDetails = {}
): ConflictException {
	return inventoryError(InventoryErrorCode.INVARIANT_VIOLATION, message, {
		details: { ...details, invariant }
	}) as ConflictException;
}
