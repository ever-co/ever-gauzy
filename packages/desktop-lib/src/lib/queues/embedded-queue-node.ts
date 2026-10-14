import * as util from 'node:util';

/**
 * Restores the `util.isDate` / `util.isRegExp` type checks that Node 23 removed, on `target` (Node's `util` module
 * by default), unless they exist.
 *
 * The timer's in-memory job queue is `embedded-queue`, whose store is `nedb` (no longer maintained), and nedb calls
 * both checks on every document it stores. Electron 44 runs Node 24, where they are gone: every queued job failed
 * with "TypeError: util.isDate is not a function". Call this before `require('embedded-queue')`.
 */
export function restoreUtilTypeChecks(target: Record<string, unknown> = util as unknown as Record<string, unknown>): void {
	if (typeof target['isDate'] === 'undefined') {
		target['isDate'] = (value: unknown): boolean => util.types.isDate(value);
	}
	if (typeof target['isRegExp'] === 'undefined') {
		target['isRegExp'] = (value: unknown): boolean => util.types.isRegExp(value);
	}
}
