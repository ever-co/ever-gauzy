import { AsyncLocalStorage } from 'node:async_hooks';
import { ID } from '@gauzy/contracts';

/**
 * The employee whose running write is made by someone who may not turn their time tracking on or off.
 *
 * Where the organization restricts the switch to higher roles, the update handler lets such a caller change the
 * work dates only when the dates leave the tracking as the handler read it. The employee subscriber derives the
 * switch from the dates when the row is written, which is later: a switch an admin makes in between must not be
 * undone by a date change the check read as harmless. For this write, the subscriber leaves the switch out, so the
 * row keeps the value it holds when written, whoever set it.
 */
const trackingKeptAtWrite = new AsyncLocalStorage<ID>();

/**
 * Runs a write of the employee in which their work dates leave the tracking switch as the row holds it.
 *
 * @param employeeId The employee the write updates.
 * @param write The write.
 * @returns What the write answers.
 */
export function keepingTrackingAtWrite<T>(employeeId: ID, write: () => Promise<T>): Promise<T> {
	return trackingKeptAtWrite.run(employeeId, write);
}

/**
 * Whether the running write must leave this employee's tracking switch as the row holds it.
 *
 * @param employeeId The employee being written.
 */
export function keepsTrackingAtWrite(employeeId: ID | undefined): boolean {
	return !!employeeId && trackingKeptAtWrite.getStore() === employeeId;
}
