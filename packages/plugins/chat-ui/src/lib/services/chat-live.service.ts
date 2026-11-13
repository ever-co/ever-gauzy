import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { combineLatest, EMPTY, fromEvent, merge, Observable, of, throwError } from 'rxjs';
import { catchError, distinctUntilChanged, filter, ignoreElements, map } from 'rxjs/operators';
import { IRealtimeStatus } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { RealtimeSocketService } from '@gauzy/ui-core/core';
import { CHAT_LIVE_SAFETY_POLL_MS } from '../chat-ui.constants';
import { ChatAvailabilityService, isFinalRefusal } from './chat-availability.service';
import { ChatPresenceUpdate } from '../chat-presence';
import { ChatHint, ChatLiveChannel, ChatLiveMode, ChatSocketStatus, ChatTypingSignal, pollTicks } from './chat-live';

/** Whether the tab is shown (a hidden tab neither polls nor refetches; it catches up when shown again). */
export function isTabVisible(): boolean {
	return typeof document === 'undefined' || !document.hidden;
}

/**
 * The chat's live channel for the tab (see {@link ChatLiveChannel}): the chat events of the platform's
 * collaboration subscription over the shared socket (`RealtimeSocketService`), followed while the chat is served
 * to the signed-in user in the selected organization. Where the platform does not stream them, or the socket is
 * down, every part keeps polling as it did before.
 */
@Injectable({ providedIn: 'root' })
export class ChatLiveService {
	private readonly channel: ChatLiveChannel;

	/** The chat events, as hints to refetch what they name. */
	readonly hints$: Observable<ChatHint>;
	/** The members' typing signals (where the platform offers them). */
	readonly typing$: Observable<ChatTypingSignal>;
	/** The people's presence changes (where the platform offers them). */
	readonly presence$: Observable<ChatPresenceUpdate>;
	readonly mode$: Observable<ChatLiveMode>;
	/**
	 * When to catch up with what the stream may have missed: the mode became `live` (first time, after a reconnect)
	 * while the tab is shown, or the tab was shown again (which also covers a reconnect while it was hidden).
	 */
	readonly catchUp$: Observable<void>;

	constructor() {
		const http = inject(HttpClient);
		const socket = inject(RealtimeSocketService);
		const availability = inject(ChatAvailabilityService);
		const scope$ = combineLatest([availability.scope$, availability.available$]).pipe(
			map(([scope, available]) => (scope && available ? `${scope.userId}:${scope.organizationId ?? ''}` : null)),
			distinctUntilChanged()
		);
		this.channel = new ChatLiveChannel({
			scope$,
			status: () =>
				http
					.get<IRealtimeStatus>(`${API_PREFIX}/realtime/status`)
					.pipe(catchError((error: HttpErrorResponse) => (isFinalRefusal(error) ? of(null) : throwError(() => error)))),
			subscribe: (query, variables) => socket.subscribe(query, variables),
			socketStatus$: socket.status$ as Observable<ChatSocketStatus>
		});
		this.hints$ = this.channel.hints$;
		this.typing$ = this.channel.typing$;
		this.presence$ = this.channel.presence$;
		this.mode$ = this.channel.mode$;
		const shown$ =
			typeof document === 'undefined'
				? EMPTY
				: fromEvent(document, 'visibilitychange').pipe(
						filter(() => isTabVisible()),
						map(() => undefined)
					);
		this.catchUp$ = merge(this.channel.resumed$.pipe(filter(() => isTabVisible())), shown$);
	}

	/**
	 * The ticks of a part's poll: every `fallbackMs` as before, or every {@link CHAT_LIVE_SAFETY_POLL_MS} while the
	 * channel is live; only while the tab is shown. Listening keeps the channel open.
	 */
	ticks(fallbackMs: number): Observable<void> {
		return merge(this.hints$.pipe(ignoreElements()), pollTicks(this.mode$, fallbackMs, CHAT_LIVE_SAFETY_POLL_MS)).pipe(
			filter(() => isTabVisible()),
			map(() => undefined)
		);
	}
}
