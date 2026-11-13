import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { combineLatest, EMPTY, fromEvent, merge, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap, throttleTime } from 'rxjs/operators';
import { IEmployeePresence, IRealtimePresence, IUser, REALTIME_PRESENCE_TTL_SECONDS, RealtimePresenceStatus } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { CHAT_PRESENCE_REPORT_MS, mostPresent, presenceOfStatus, tabStatus } from '../chat-presence';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatPresenceService } from './chat-presence.service';

/** How often the tab looks whether it went idle (without input, nothing else would tell it). */
const CHAT_PRESENCE_CHECK_MS = 15_000;
/** Input is noted at most this often (a moving pointer fires many events). */
const CHAT_PRESENCE_INPUT_THROTTLE_MS = 2_000;
/** The input that counts as the person being here. */
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

/** The tabs of one browser tell each other when the person sets themselves away or back. */
export const CHAT_PRESENCE_AWAY_CHANNEL = 'gauzy-chat-presence-away';

/** When an away change was made, ordered the same way in every tab of one browser (they share a clock). */
export interface AwayStamp {
	/** Epoch ms, strictly increasing within a tab (a change in the same millisecond as the last one known moves on by one). */
	at: number;
	/** The tab that made it: two changes made at the same moment are ordered by it. */
	tab: string;
}

/** Whether `a` was made after `b`. */
export function isNewerAway(a: AwayStamp, b: AwayStamp | null): boolean {
	if (!b) return true;
	return a.at !== b.at ? a.at > b.at : a.tab > b.tab;
}

/** What a tab tells the others on {@link CHAT_PRESENCE_AWAY_CHANNEL}. */
interface AwayMessage {
	employeeId: string;
	isAway: boolean;
	stamp: AwayStamp;
}

/**
 * The tabs of one browser tell each other what each reports, so the employee's own heartbeat (which keeps one value
 * per person, not one per tab) is sent the most present of them.
 */
export const CHAT_PRESENCE_TABS_CHANNEL = 'gauzy-chat-presence-tabs';

/** What a tab tells the others on {@link CHAT_PRESENCE_TABS_CHANNEL}. */
interface TabMessage {
	connectionId: string;
	employeeId: string;
	status: RealtimePresenceStatus;
}

/** Where this tab's reports go: the realtime channel, the employee's own heartbeat where it has none, or nowhere. */
type ReportRoute = 'realtime' | 'employee' | 'none';

/** An id for this tab's connection: letters, digits and `-`, as the presence route accepts (at most 64). */
export function newConnectionId(): string {
	const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	return `tab-${random}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

/** A refusal that will not change by asking again: the route is not there (404), or not for this user (401, 403). */
function isFinal(error: unknown): boolean {
	const status = (error as HttpErrorResponse | null)?.status;
	return status === 404 || status === 401 || status === 403;
}

function employeeIdOf(user: IUser | null | undefined): string | null {
	const id = user?.employee?.id ?? user?.employeeId;
	return id ? String(id) : null;
}

/**
 * Tells the platform this person is here, from every page of the app while they are signed in and the chat is served to
 * them: `active` while the tab is shown and used, `idle` after a few minutes without input, `away` while it is hidden,
 * at once on a change and every minute regardless (the platform forgets a tab after 150 s without a report), and
 * `offline` when the tab closes. Each tab reports under its own connection id; the platform merges them.
 *
 * Someone who set themselves as away (the user menu's "Set yourself as away", `Employee.isAway`) is reported `away`
 * from every tab, whatever they do, until they set themselves back: the platform shows the most present of their tabs,
 * so one tab still saying `active` would undo it. The tab where they changed it tells the others of this browser.
 *
 * The reports go to the realtime channel (`POST /api/realtime/presence`), which tells the organization and merges the
 * tabs itself. Where the API has no channel (`GAUZY_REALTIME_ENABLED` off), they go to the employee's own heartbeat
 * (`PUT /api/employee/me/presence`), which the people list reads; it keeps one value for the person, so each tab sends
 * the most present status of this browser's tabs (a hidden tab must not undo the one being typed in; another device
 * still can). Where neither route takes the reports (a user without an employee record), the tab stops reporting.
 */
@Injectable({ providedIn: 'root' })
export class ChatPresenceReporterService {
	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);
	private readonly availability = inject(ChatAvailabilityService);
	private readonly presence = inject(ChatPresenceService);

	private readonly connectionId = newConnectionId();
	private route: ReportRoute = 'realtime';
	private lastInputAt = Date.now();
	private running: Subscription | null = null;
	/** What the other tabs of this browser last said they report, by connection id. */
	private readonly tabs = new Map<string, { employeeId: string; status: RealtimePresenceStatus; at: number }>();
	private tabsChannel: BroadcastChannel | null = null;

	/** Starts reporting (once for the app; a second call returns the same subscription). */
	start(): Subscription {
		if (this.running && !this.running.closed) return this.running;
		const employee$ = combineLatest([this.store.user$ as Observable<IUser | null | undefined>, this.availability.available$]).pipe(
			map(([user, available]) => (available ? employeeIdOf(user) : null)),
			distinctUntilChanged()
		);
		this.running = merge(
			employee$.pipe(
				switchMap((employeeId) => {
					// Someone else, or the same person again: try the realtime channel first.
					this.route = 'realtime';
					return employeeId ? merge(this.reports(employeeId), this.closing(employeeId)) : EMPTY;
				})
			),
			this.awaySync(),
			this.tabSync()
		).subscribe();
		return this.running;
	}

	/** Whether the person set themselves as away, as the signed-in user in the store says. */
	private awayOf(employeeId: string): Observable<boolean> {
		return (this.store.user$ as Observable<IUser | null | undefined>).pipe(
			map((user) => employeeIdOf(user) === employeeId && !!user?.employee?.isAway),
			distinctUntilChanged()
		);
	}

	/**
	 * Keeps the away flag the same in every tab of this browser: a change in the store here is stamped and told to the
	 * others, and one told by another tab is written to the store here (the header's avatar follows it too) unless a
	 * newer change is already known, so every tab ends on the latest change whatever order the messages arrive in.
	 * Writing back what was told is not a change of this tab, so the tabs do not echo each other.
	 */
	private awaySync(): Observable<never> {
		if (typeof BroadcastChannel === 'undefined') return EMPTY;
		return new Observable<never>(() => {
			const channel = new BroadcastChannel(CHAT_PRESENCE_AWAY_CHANNEL);
			/** The flag this tab holds for the signed-in person, and the newest change of it known here. */
			let last: { employeeId: string; isAway: boolean } | null = null;
			let latest: AwayStamp | null = null;
			channel.onmessage = (event: MessageEvent<AwayMessage>) => {
				const { employeeId, isAway, stamp } = event.data ?? ({} as AwayMessage);
				const user = this.store.user;
				if (typeof isAway !== 'boolean' || typeof stamp?.at !== 'number' || typeof stamp?.tab !== 'string') return;
				if (!user?.employee || employeeIdOf(user) !== employeeId) return;
				// An older change than one already known (made here, or told by another tab) never overwrites it.
				if (!isNewerAway(stamp, latest)) return;
				latest = stamp;
				if (!!user.employee.isAway === isAway) return;
				// Known before it is written: the store's change below is not a change of this tab, so it is not told back.
				last = { employeeId, isAway };
				this.store.user = { ...user, employee: { ...user.employee, isAway } };
			};
			const changes = (this.store.user$ as Observable<IUser | null | undefined>).subscribe((user) => {
				const employeeId = employeeIdOf(user);
				const current = employeeId ? { employeeId, isAway: !!user?.employee?.isAway } : null;
				if (current && last?.employeeId !== current.employeeId) latest = null;
				// A change of the same person's flag (not the first look at them, nor another person signing in).
				if (current && last && last.employeeId === current.employeeId && last.isAway !== current.isAway) {
					latest = { at: Math.max(Date.now(), (latest?.at ?? 0) + 1), tab: this.connectionId };
					const message: AwayMessage = { ...current, stamp: latest };
					channel.postMessage(message);
				}
				last = current;
			});
			return () => {
				changes.unsubscribe();
				channel.close();
			};
		});
	}

	/** Listens to what the other tabs of this browser report (see {@link CHAT_PRESENCE_TABS_CHANNEL}). */
	private tabSync(): Observable<never> {
		if (typeof BroadcastChannel === 'undefined') return EMPTY;
		return new Observable<never>(() => {
			const channel = new BroadcastChannel(CHAT_PRESENCE_TABS_CHANNEL);
			channel.onmessage = (event: MessageEvent<TabMessage>) => {
				const { connectionId, employeeId, status } = event.data ?? ({} as TabMessage);
				if (typeof connectionId !== 'string' || typeof employeeId !== 'string' || connectionId === this.connectionId) return;
				if (status === RealtimePresenceStatus.OFFLINE) this.tabs.delete(connectionId);
				else this.tabs.set(connectionId, { employeeId, status, at: Date.now() });
			};
			this.tabsChannel = channel;
			return () => {
				this.tabsChannel = null;
				this.tabs.clear();
				channel.close();
			};
		});
	}

	/** Tells the other tabs what this one reports. */
	private announce(employeeId: string, status: RealtimePresenceStatus): void {
		const message: TabMessage = { connectionId: this.connectionId, employeeId, status };
		this.tabsChannel?.postMessage(message);
	}

	/** The most present of this tab and the other tabs of this browser that reported lately, for the same person. */
	private browserStatus(employeeId: string, status: RealtimePresenceStatus): RealtimePresenceStatus {
		const fresh = Date.now() - REALTIME_PRESENCE_TTL_SECONDS * 1000;
		const others: RealtimePresenceStatus[] = [];
		for (const [connectionId, tab] of this.tabs) {
			if (tab.at < fresh) this.tabs.delete(connectionId);
			else if (tab.employeeId === employeeId) others.push(tab.status);
		}
		return mostPresent([status, ...others]);
	}

	/** The status as it changes, sent at once and then every minute until it changes again. */
	private reports(employeeId: string): Observable<unknown> {
		if (typeof document === 'undefined') return EMPTY;
		this.lastInputAt = Date.now();
		const input$ = merge(...INPUT_EVENTS.map((name) => fromEvent(document, name, { passive: true }))).pipe(
			throttleTime(CHAT_PRESENCE_INPUT_THROTTLE_MS),
			map(() => (this.lastInputAt = Date.now()))
		);
		const tab$ = merge(of(null), input$, fromEvent(document, 'visibilitychange'), timer(CHAT_PRESENCE_CHECK_MS, CHAT_PRESENCE_CHECK_MS)).pipe(
			map(() => tabStatus(!document.hidden, this.lastInputAt))
		);
		// Away by choice wins over whatever the tab sees.
		const status$ = combineLatest([this.awayOf(employeeId), tab$]).pipe(
			map(([away, status]) => (away ? RealtimePresenceStatus.AWAY : status)),
			distinctUntilChanged()
		);
		const reports$ = status$.pipe(
			switchMap((status) => timer(0, CHAT_PRESENCE_REPORT_MS).pipe(map(() => status))),
			switchMap((status) => this.send(employeeId, status))
		);
		// A page restored from the back-forward cache said `offline` as it left: it starts over.
		const shown$ = typeof window === 'undefined' ? EMPTY : fromEvent<PageTransitionEvent>(window, 'pageshow').pipe(filter((event) => event.persisted));
		return merge(of(null), shown$).pipe(switchMap(() => reports$));
	}

	/** The tab closing says so (best effort: the platform forgets a tab that stopped reporting anyway). */
	private closing(employeeId: string): Observable<unknown> {
		if (typeof window === 'undefined') return EMPTY;
		return fromEvent(window, 'pagehide').pipe(
			switchMap(() => {
				this.announce(employeeId, RealtimePresenceStatus.OFFLINE);
				return this.route === 'realtime' ? this.post(RealtimePresenceStatus.OFFLINE).pipe(catchError(() => EMPTY)) : EMPTY;
			})
		);
	}

	/** Sends one report the way that works here, and shows my own presence at once. */
	private send(employeeId: string, status: RealtimePresenceStatus): Observable<unknown> {
		this.announce(employeeId, status);
		if (this.route === 'realtime') {
			return this.post(status).pipe(
				map((merged) => {
					// The answer is my presence merged over all my tabs (another tab may be more present than this one).
					this.presence.apply({
						employeeId: String(merged?.employeeId ?? employeeId),
						presence: presenceOfStatus(merged?.status ?? status),
						lastSeenAt: Date.now(),
						revision: typeof merged?.revision === 'number' ? merged.revision : null
					});
				}),
				catchError((error) => {
					if (!isFinal(error)) return EMPTY;
					// No realtime channel for me: the employee's own heartbeat instead.
					this.route = 'employee';
					return this.send(employeeId, status);
				})
			);
		}
		if (this.route === 'employee') {
			// One value for the person: the most present of this browser's tabs, not this tab's alone.
			const merged = this.browserStatus(employeeId, status);
			return this.http.put<IEmployeePresence>(`${API_PREFIX}/employee/me/presence`, { isIdle: merged !== RealtimePresenceStatus.ACTIVE }).pipe(
				map(() => this.presence.apply({ employeeId, presence: presenceOfStatus(merged), lastSeenAt: Date.now(), revision: null })),
				catchError((error) => {
					if (isFinal(error)) this.route = 'none';
					return EMPTY;
				})
			);
		}
		return EMPTY;
	}

	private post(status: RealtimePresenceStatus): Observable<IRealtimePresence> {
		return this.http.post<IRealtimePresence>(`${API_PREFIX}/realtime/presence`, { status, connectionId: this.connectionId });
	}
}
