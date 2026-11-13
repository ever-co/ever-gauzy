import { inject, Injectable, signal } from '@angular/core';
import { combineLatest, defer, EMPTY, merge, NEVER, Observable, timer } from 'rxjs';
import { catchError, distinctUntilChanged, ignoreElements, map, share, startWith, switchMap, tap } from 'rxjs/operators';
import {
	applyPresenceEvent,
	applyPresenceList,
	CHAT_PRESENCE_POLL_MS,
	ChatPresence,
	ChatPresenceEntry,
	ChatPresenceUpdate,
	presenceOfRecord
} from '../chat-presence';
import { coalesceReads } from './chat-live';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatLiveService } from './chat-live.service';
import { ChatPersonRecord, ChatUiService } from './chat-ui.service';

/** How long the feed stays open after the last person on screen left (a view switch shows them again at once). */
const CHAT_PRESENCE_LINGER_MS = 30_000;

const EMPTY_BOOK: ReadonlyMap<string, ChatPresenceEntry> = new Map();

/**
 * Who is here: each person's presence (online, away, offline) and when they were last seen, by employee id, for every
 * avatar and every name the chat shows. Seeded by the people list (`GET /chat/people` answers each person's presence),
 * kept current by the realtime channel's `presence.changed` where the platform streams it, and read again every
 * minute while the tab is shown (the only source where it does not), and whenever the socket reconnects or the tab is
 * shown again (a change missed meanwhile).
 *
 * The feed runs while something on screen shows a person ({@link watch}), and for a moment after.
 */
@Injectable({ providedIn: 'root' })
export class ChatPresenceService {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly availability = inject(ChatAvailabilityService);

	private readonly book = signal<ReadonlyMap<string, ChatPresenceEntry>>(EMPTY_BOOK);

	/** The feed: one for the tab, whoever watches. */
	private readonly feed$: Observable<never> = combineLatest([this.availability.scope$, this.availability.available$]).pipe(
		map(([scope, available]) => (scope && available ? `${scope.userId}:${scope.organizationId ?? ''}` : null)),
		distinctUntilChanged(),
		switchMap((scope) => {
			if (!scope) {
				// Signed out: nothing known holds any more (presence is per employee, so another organization keeps it).
				this.book.set(EMPTY_BOOK);
				return NEVER;
			}
			const events$ = this.live.presence$.pipe(tap((update) => this.apply(update)));
			// Back on a person after a while: what is known may be old, so read at once. The first time, the people
			// list the page loads anyway says it (`ChatPeopleService`), so there is no read of its own.
			const ticks$ = this.book().size ? this.live.ticks(CHAT_PRESENCE_POLL_MS).pipe(startWith(undefined)) : this.live.ticks(CHAT_PRESENCE_POLL_MS);
			// A change missed while the socket was down or the tab hidden: read again once it is back.
			return merge(events$, merge(ticks$, this.live.catchUp$).pipe(coalesceReads(() => this.read())));
		}),
		ignoreElements(),
		share({ resetOnRefCountZero: () => timer(CHAT_PRESENCE_LINGER_MS) })
	);

	/** Keeps the feed open while the returned observable is subscribed (an avatar, while it is on screen). */
	watch(): Observable<never> {
		return this.feed$;
	}

	/** Their presence, `offline` when nothing is known. Reading it in a template follows its changes. */
	presenceOf(employeeId: string | null | undefined): ChatPresence {
		return (employeeId && this.book().get(String(employeeId))?.presence) || 'offline';
	}

	/** When they were last seen (epoch ms), when known. */
	lastSeenOf(employeeId: string | null | undefined): number | null {
		return (employeeId && this.book().get(String(employeeId))?.lastSeenAt) || null;
	}

	/** One person's presence as it changed (a `presence.changed`, my own report). */
	apply(update: ChatPresenceUpdate): void {
		this.book.update((book) => applyPresenceEvent(book, update));
	}

	/** The people as a list read that started at `askedAt` answered them. */
	applyList(records: readonly ChatPersonRecord[], askedAt: number): void {
		const updates = (records ?? []).map((record) => presenceOfRecord(record)).filter((update): update is ChatPresenceUpdate => update !== null);
		this.book.update((book) => applyPresenceList(book, updates, askedAt));
	}

	/** Reads the people again for their presence; a failure waits for the next tick. */
	private read(): Observable<void> {
		return defer(() => {
			const askedAt = Date.now();
			return this.api.people().pipe(
				tap((records) => this.applyList(records, askedAt)),
				map(() => undefined),
				catchError(() => EMPTY)
			);
		});
	}
}
