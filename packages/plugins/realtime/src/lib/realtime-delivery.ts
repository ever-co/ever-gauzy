import { resolveDatabaseType } from '@gauzy/config';
import { IRealtimeDelivery } from '@gauzy/contracts';

/**
 * How promptly a written fact reaches an open subscription, from how this process dispatches the outbox,
 * whether its pub/sub reaches every API process, and whether there is only one API process.
 *
 * Prompt when the event is dispatched right after it is written AND reaches the socket whichever process
 * dispatches it: the pub/sub is shared, or there is only one API process to hold sockets. With several API
 * processes and no shared pub/sub, a pass run by one of them reaches only its own sockets, so a client on
 * another must keep polling.
 *
 * @param dispatch How appended events are dispatched in this process.
 * @param shared Whether a publish reaches the sockets of every API process.
 * @param singleProcess Whether this installation runs one API process (see {@link isSingleApiProcess}).
 * @returns What the status route reports.
 */
export function describeRealtimeDelivery(
	dispatch: IRealtimeDelivery['dispatch'],
	shared: boolean,
	singleProcess: boolean
): IRealtimeDelivery {
	return {
		dispatch,
		shared,
		singleProcess,
		prompt: dispatch !== 'none' && (shared || singleProcess)
	};
}

/**
 * Whether this installation runs a single API process.
 *
 * True on SQLite: its database is a file of one process, so replicas would not share data in the first place.
 * Elsewhere only when the deployment says so (`GAUZY_API_SINGLE_PROCESS=true`), because nothing in one process
 * can tell how many others serve the same database. An unset or empty `DB_TYPE` is read the way the platform's
 * database configuration reads it (`better-sqlite3`).
 *
 * @param dbType The configured `DB_TYPE`.
 * @param declared The `GAUZY_API_SINGLE_PROCESS` setting.
 */
export function isSingleApiProcess(
	dbType: string | undefined = process.env['DB_TYPE'],
	declared: string | undefined = process.env['GAUZY_API_SINGLE_PROCESS']
): boolean {
	const resolved = resolveDatabaseType(dbType);
	return declared === 'true' || resolved === 'sqlite' || resolved === 'better-sqlite3';
}
