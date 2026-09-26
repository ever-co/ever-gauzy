import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * How a numbering series restarts.
 */
export enum SequenceResetPolicy {
	/** The series never restarts; it continues for the life of the organization. */
	NEVER = 'NEVER',
	/** The series restarts on the first day of each calendar year. */
	YEARLY = 'YEARLY',
	/** The series restarts on the first day of each calendar month. */
	MONTHLY = 'MONTHLY',
	/** The series restarts at the start of each calendar day. */
	DAILY = 'DAILY'
}

/**
 * A numbering series.
 *
 * Documents that a person reads and quotes — a sales order, a return, a purchase order, an invoice —
 * carry a human-facing number. The number has to be unique, gapless enough to be defensible in an
 * audit, and allocated without two concurrent writers producing the same value. A series captures
 * that: a key, an optional scope, a format, and the next value to hand out.
 */
export interface ISequence extends IBasePerTenantAndOrganizationEntityModel {
	/** Series key, upper snake case, for example `ORDER` or `PURCHASE_ORDER`. */
	key: string;

	/** Channel the series belongs to, when the same key numbers documents per sales channel. */
	channelId?: ID;

	/** Text placed before the number, for example `SO-`. */
	prefix?: string;

	/** Minimum number of digits; shorter values are left-padded with zeroes. */
	padding: number;

	/** Value handed out by the next allocation. */
	nextValue: number;

	/** Increment applied per allocation. */
	step: number;

	/** When the series restarts. */
	resetPolicy: SequenceResetPolicy;

	/** When the series last restarted, used to decide whether a restart is due. */
	lastResetAt?: Date;

	/** Free-text note for operators. */
	description?: string;
}

/**
 * Input for creating or updating a numbering series.
 */
export interface ISequenceCreateInput extends Partial<Omit<ISequence, 'nextValue'>> {
	key: string;
	nextValue?: number;
}

/**
 * A number that has been allocated from a series.
 */
export interface IAllocatedNumber {
	/** The formatted value, including prefix and padding. */
	formatted: string;

	/** The numeric value that was allocated. */
	value: number;

	/** The series the value came from. */
	key: string;
}
