import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbBadgeModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, merge, Subject, timer } from 'rxjs';
import { catchError, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { IChatStates } from '@gauzy/contracts';
import { CHAT_BADGE_POLL_MS, CHAT_LINK } from '../../chat-ui.constants';
import { badgeText } from '../../chat-ui.helpers';
import { ChatUiService } from '../../services/chat-ui.service';

/** How many conversations hold unread messages, plus the followed threads with unread replies. */
export function unreadOf(states: IChatStates | null | undefined): number {
	const conversations = (states?.states ?? []).filter((state) => (state.unreadCount ?? 0) > 0 || (state.mentionCount ?? 0) > 0).length;
	const threads = (states?.threads ?? []).filter((thread) => (thread.unreadReplies ?? 0) > 0).length;
	return conversations + threads;
}

/** The chat icon of the header with the count of conversations and threads holding something unread. */
@Component({
	selector: 'ngx-chat-header-badge',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, NbBadgeModule, NbIconModule, TranslatePipe],
	template: `
		<a
			class="chat-badge"
			data-test="chat-badge"
			[routerLink]="link"
			[attr.aria-label]="'CHAT.BADGE_LABEL' | translate: { count: unread() }"
			[attr.title]="'CHAT.BADGE_LABEL' | translate: { count: unread() }"
		>
			<nb-icon icon="message-circle-outline"></nb-icon>
			@if (text()) {
				<nb-badge data-test="chat-badge-count" [text]="text()" status="danger" position="top right"></nb-badge>
			}
		</a>
	`,
	styles: [
		`
			.chat-badge {
				position: relative;
				display: inline-flex;
				align-items: center;
				padding: 0 0.25rem;
				color: inherit;
			}
		`
	]
})
export class ChatHeaderBadgeComponent implements OnInit {
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly stop$ = new Subject<void>();

	protected readonly link = CHAT_LINK;
	readonly unread = signal(0);
	readonly text = signal('');

	ngOnInit(): void {
		const tick$ = timer(0, CHAT_BADGE_POLL_MS).pipe(filter(() => typeof document === 'undefined' || !document.hidden));
		merge(tick$, this.api.changed$)
			.pipe(
				switchMap(() =>
					this.api.states().pipe(
						catchError((error: HttpErrorResponse) => {
							if (error?.status === 404 || error?.status === 403 || error?.status === 401) this.stop$.next();
							return EMPTY;
						})
					)
				),
				tap((states: IChatStates) => this.show(unreadOf(states))),
				takeUntil(this.stop$),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}

	private show(unread: number): void {
		this.unread.set(unread);
		this.text.set(badgeText(unread));
	}
}
