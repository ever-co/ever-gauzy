import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbBadgeModule, NbIconModule, NbPopoverDirective, NbPopoverModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, merge, of, Subject, timer } from 'rxjs';
import { catchError, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { IInboxItemCounts, IInboxItemWithState, InboxTabEnum } from '@gauzy/contracts';
import { INBOX_BADGE_POLL_MS, INBOX_LINK } from '../../inbox-ui.constants';
import { kindIconOf, listDateFormat, previewOf } from '../../inbox-ui.helpers';
import { InboxUiService } from '../../services/inbox-ui.service';

/** How many items the header's dropdown lists; the rest is one click away on the Inbox page. */
export const INBOX_HEADER_MENU_SIZE = 6;

/** The badge text: nothing at 0, `99+` above 99. */
export function badgeText(unread: number): string {
	if (!Number.isFinite(unread) || unread <= 0) return '';
	return unread > 99 ? '99+' : String(Math.floor(unread));
}

type MenuState = 'loading' | 'ready' | 'error';

/**
 * The header's Inbox action (plan 04 §1): a bell with my unread count. A click opens a dropdown of my latest items
 * (read when it opens); a row opens that item on `/pages/inbox` and "See all" the page itself. The count is
 * read every 60 s (P3a), not while the tab is hidden, and at once when the page changed my items. A 404 (the API does not load the Inbox) or a 403 (no
 * `INBOX_VIEW`) stops the polling; other failures keep the last count and try again on the next tick.
 */
@Component({
	selector: 'ngx-inbox-header-badge',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbBadgeModule, NbIconModule, NbPopoverModule, TranslatePipe],
	template: `
		<button
			type="button"
			class="inbox-badge"
			data-test="inbox-badge"
			[nbPopover]="menu"
			nbPopoverTrigger="click"
			nbPopoverPlacement="bottom-start"
			nbPopoverAdjustment="noop"
			[nbPopoverOffset]="8"
			nbPopoverClass="inbox-header-menu-popover"
			(nbPopoverShowStateChange)="onShowChange($event.isShown)"
			aria-haspopup="true"
			[attr.aria-expanded]="open()"
			[attr.aria-label]="'INBOX.BADGE_LABEL' | translate: { count: unread() }"
			[attr.title]="'INBOX.BADGE_LABEL' | translate: { count: unread() }"
		>
			<nb-icon icon="bell-outline"></nb-icon>
			@if (text()) {
				<nb-badge data-test="inbox-badge-count" [text]="text()" status="danger" position="top right"></nb-badge>
			}
		</button>

		<ng-template #menu>
			<div class="menu" data-test="inbox-menu">
				<div class="menu-head">{{ 'INBOX.TITLE' | translate }}</div>
				<div class="menu-body">
					@switch (state()) {
						@case ('loading') {
							<p class="menu-note">{{ 'INBOX.HEADER_MENU.LOADING' | translate }}</p>
						}
						@case ('error') {
							<p class="menu-note">{{ 'INBOX.HEADER_MENU.ERROR' | translate }}</p>
						}
						@default {
							@for (item of items(); track item.id) {
								<a
									class="row"
									[class.unread]="!item.recipient?.isRead"
									[routerLink]="link"
									[queryParams]="{ item: item.id }"
									[attr.data-test]="'inbox-menu-' + item.id"
									(click)="choose(item.id)"
								>
									<span class="kind" aria-hidden="true"><nb-icon [icon]="kindIcon(item.kind)"></nb-icon></span>
									<span class="row-main">
										<span class="row-top">
											<span class="row-title">{{ item.title }}</span>
											<time class="row-time" [attr.datetime]="item.createdAt">{{ item.createdAt | date: dateFormat(item.createdAt) }}</time>
										</span>
										@if (preview(item); as text) {
											<span class="row-preview">{{ text }}</span>
										}
									</span>
									@if (!item.recipient?.isRead) {
										<span class="row-dot" aria-hidden="true"></span>
									}
								</a>
							} @empty {
								<p class="menu-note">{{ 'INBOX.HEADER_MENU.EMPTY' | translate }}</p>
							}
						}
					}
				</div>
				<a class="menu-all" data-test="inbox-menu-all" [routerLink]="link" (click)="close()">{{ 'INBOX.HEADER_MENU.SEE_ALL' | translate }}</a>
			</div>
		</ng-template>
	`,
	styles: [
		`
			.inbox-badge {
				position: relative;
				display: inline-flex;
				align-items: center;
				padding: 0 0.25rem;
				border: 0;
				background: none;
				color: inherit;
				font: inherit;
				cursor: pointer;
			}
			.menu {
				display: flex;
				flex-direction: column;
				box-sizing: border-box;
				width: 260px;
				max-width: calc(100vw - 32px);
			}
			.menu-head {
				padding: 12px 16px 8px;
				font-size: 13px;
				font-weight: 600;
				color: var(--gauzy-text-color-1);
			}
			.menu-body {
				max-height: 360px;
				overflow-x: hidden;
				overflow-y: auto;
				padding: 0 0 4px;
			}
			.menu-note {
				margin: 0;
				padding: 12px 16px;
				font-size: 12px;
				color: var(--gauzy-text-color-2);
			}
			.menu .row {
				display: flex;
				align-items: flex-start;
				gap: 8px;
				min-width: 0;
				margin: 0 8px;
				padding: 8px;
				border-radius: calc(var(--border-radius) * 0.75);
				color: var(--gauzy-text-color-1);
				text-decoration: none;
				font-size: 12px;
				line-height: 16px;
			}
			.menu .row:hover,
			.menu .row:focus-visible {
				background: var(--gauzy-hover-tint);
				text-decoration: none;
				color: var(--gauzy-text-color-1);
			}
			.kind {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				border-radius: calc(var(--border-radius) * 0.75);
				background: var(--background-basic-color-3);
				color: var(--gauzy-text-color-2);
			}
			.kind nb-icon {
				font-size: 14px;
			}
			.row-main {
				display: flex;
				flex: 1 1 auto;
				flex-direction: column;
				gap: 2px;
				min-width: 0;
			}
			.row-top {
				display: flex;
				align-items: baseline;
				gap: 8px;
			}
			.row-title {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.row.unread .row-title {
				font-weight: 600;
			}
			.row-time {
				flex: 0 0 auto;
				font-size: 11px;
				color: var(--gauzy-text-color-2);
			}
			.row-preview {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-size: 11px;
				color: var(--gauzy-text-color-2);
			}
			.row-dot {
				flex: 0 0 auto;
				width: 6px;
				height: 6px;
				margin-top: 5px;
				border-radius: 50%;
				background: var(--color-primary-default);
			}
			.menu-all {
				display: block;
				margin-top: 4px;
				padding: 10px 16px;
				border-top: 1px solid var(--border-basic-color-3);
				color: var(--color-primary-default);
				font-size: 12px;
				font-weight: 600;
				text-align: center;
				text-decoration: none;
			}
			.menu-all:hover,
			.menu-all:focus-visible {
				background: var(--gauzy-hover-tint);
				text-decoration: none;
			}
			/* The popover frame around the panel (no arrow, no padding, its offset) is styled with the other overlays:
			   .inbox-header-menu-popover in ui-core's _overlays.scss. */
		`
	]
})
export class InboxHeaderBadgeComponent implements OnInit {
	private readonly api = inject(InboxUiService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly popover = viewChild(NbPopoverDirective);
	private readonly stop$ = new Subject<void>();
	/** Asks for the dropdown's items (each time it opens). */
	private readonly loadMenu$ = new Subject<void>();

	protected readonly link = INBOX_LINK;
	readonly unread = signal(0);
	readonly text = signal('');
	readonly open = signal(false);
	readonly state = signal<MenuState>('loading');
	readonly items = signal<IInboxItemWithState[]>([]);

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

		this.loadMenu$
			.pipe(
				switchMap(() =>
					this.api.list({ tab: InboxTabEnum.ALL, limit: INBOX_HEADER_MENU_SIZE }).pipe(
						map((page) => page?.items ?? []),
						catchError(() => of(null))
					)
				),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((items) => {
				if (items) this.items.set(items);
				this.state.set(items ? 'ready' : 'error');
			});
	}

	onShowChange(isShown: boolean): void {
		this.open.set(isShown);
		if (!isShown) return;
		// Rows already shown stay while they are read again (an earlier failure no longer shows over them); only an
		// opening without rows says "Loading…".
		this.state.set(this.items().length ? 'ready' : 'loading');
		this.loadMenu$.next();
	}

	protected close(): void {
		this.popover()?.hide();
	}

	/**
	 * A row chosen: its link (`?item=`) opens the item on a page that starts, and an Inbox page already shown is told
	 * directly, since the link may already be its URL or its Notifications tab may be chosen.
	 */
	protected choose(id: string): void {
		this.api.requestItem(id);
		this.close();
	}

	protected kindIcon(kind: string): string {
		return kindIconOf(kind);
	}

	protected preview(item: IInboxItemWithState): string {
		return previewOf(item.body);
	}

	protected dateFormat(value: Date | string | null | undefined): string {
		return listDateFormat(value);
	}

	private show(unread: number): void {
		this.unread.set(unread);
		this.text.set(badgeText(unread));
	}
}
