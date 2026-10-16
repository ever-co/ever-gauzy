import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbBadgeModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, merge, Subject, timer } from 'rxjs';
import { catchError, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { IInboxItemCounts } from '@gauzy/contracts';
import { INBOX_BADGE_POLL_MS, INBOX_LINK } from '../../inbox-ui.constants';
import { InboxUiService } from '../../services/inbox-ui.service';

/** The badge text: nothing at 0, `99+` above 99. */
export function badgeText(unread: number): string {
	if (!Number.isFinite(unread) || unread <= 0) return '';
	return unread > 99 ? '99+' : String(Math.floor(unread));
}

/**
 * The header's Inbox action (plan 04 §1): a bell with my unread count, linking to `/pages/inbox`. The count is
 * read every 60 s (P3a), not while the tab is hidden, and at once when the page changed my items. A 404 (the API does not load the Inbox) or a 403 (no
 * `INBOX_VIEW`) stops the polling; other failures keep the last count and try again on the next tick.
 */
@Component({
	selector: 'ngx-inbox-header-badge',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, NbBadgeModule, NbIconModule, TranslatePipe],
	template: `
		<a
			class="inbox-badge"
			data-test="inbox-badge"
			[routerLink]="link"
			[attr.aria-label]="'INBOX.BADGE_LABEL' | translate: { count: unread() }"
			[attr.title]="'INBOX.BADGE_LABEL' | translate: { count: unread() }"
		>
			<nb-icon icon="bell-outline"></nb-icon>
			@if (text()) {
				<nb-badge data-test="inbox-badge-count" [text]="text()" status="danger" position="top right"></nb-badge>
			}
		</a>
	`,
	styles: [
		`
			.inbox-badge {
				position: relative;
				display: inline-flex;
				align-items: center;
				padding: 0 0.25rem;
				color: inherit;
			}
		`
	]
})
export class InboxHeaderBadgeComponent implements OnInit {
	private readonly api = inject(InboxUiService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly stop$ = new Subject<void>();

	protected readonly link = INBOX_LINK;
	readonly unread = signal(0);
	readonly text = signal('');

	ngOnInit(): void {
		const tick$ = timer(0, INBOX_BADGE_POLL_MS).pipe(
			filter(() => typeof document === 'undefined' || !document.hidden)
		);
		merge(tick$, this.api.changed$)
			.pipe(
				switchMap(() =>
					this.api.counts().pipe(
						catchError((error: HttpErrorResponse) => {
							if (error?.status === 404 || error?.status === 403 || error?.status === 401)
								this.stop$.next();
							return EMPTY;
						})
					)
				),
				tap((counts: IInboxItemCounts) => this.show(counts?.unread ?? 0)),
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
