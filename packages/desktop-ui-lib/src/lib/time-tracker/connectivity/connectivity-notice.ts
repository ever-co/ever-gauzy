/** Translation keys of the connectivity notices (`TIMER_TRACKER.TOASTR`). */
export const CONNECTIVITY_NOTICE_KEYS = {
	LOST: 'TIMER_TRACKER.TOASTR.CONNECTION_LOST',
	RESTORED: 'TIMER_TRACKER.TOASTR.CONNECTION_RESTORED',
	RESTORED_SYNCING: 'TIMER_TRACKER.TOASTR.CONNECTION_RESTORED_SYNCING'
} as const;

/** What the time tracker tells the user when its connection to the API changes (#8415). */
export interface IConnectivityNotice {
	/** `offline`: the connection was lost; `online`: it is back. */
	state: 'offline' | 'online';
	/** Translation key of the message. */
	messageKey: string;
	/** Interpolation parameters of the message. */
	params?: { count: number };
}

/**
 * The notice for a change of connectivity, or `null` when the state did not change: the main process repeats the
 * state it already sent (on every refresh of the time tracker), and the user hears about each change once.
 *
 * Going offline says that the time keeps being tracked on this device; coming back online says how many entries
 * are waiting to be synced, when there are some.
 */
export function connectivityNotice(
	wasOffline: boolean,
	isOffline: boolean,
	pendingCount = 0
): IConnectivityNotice | null {
	if (!!wasOffline === !!isOffline) {
		return null;
	}
	if (isOffline) {
		return { state: 'offline', messageKey: CONNECTIVITY_NOTICE_KEYS.LOST };
	}
	return pendingCount > 0
		? { state: 'online', messageKey: CONNECTIVITY_NOTICE_KEYS.RESTORED_SYNCING, params: { count: pendingCount } }
		: { state: 'online', messageKey: CONNECTIVITY_NOTICE_KEYS.RESTORED };
}
