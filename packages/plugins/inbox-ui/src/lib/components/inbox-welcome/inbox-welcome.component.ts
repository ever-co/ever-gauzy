import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, NgZone, output, signal } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { InboxItemKindEnum } from '@gauzy/contracts';
import { INBOX_UI_TAB_ICONS, InboxUiTab, kindIconOf } from '../../inbox-ui.helpers';

const LOOP_SECONDS = 12;
const RESET_STEP = LOOP_SECONDS - 1;

type CursorStep<T extends string> = { at: T; press?: boolean };

const DECISION_SCRIPT: ReadonlyArray<CursorStep<'rest' | 'approve' | 'send'>> = [
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'approve' },
	{ at: 'approve', press: true },
	{ at: 'send' },
	{ at: 'send', press: true },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' }
];
const APPROVE_CHOSEN_STEP = 3;
const ANSWERED_STEP = 6;

const MAIL_SCRIPT: ReadonlyArray<CursorStep<'rest' | 'pill' | 'row'>> = [
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'pill' },
	{ at: 'pill', press: true },
	{ at: 'row' },
	{ at: 'row', press: true },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' }
];
const MAIL_PILL_STEP = 1;
const MAIL_SHOWN_STEP = 4;
const MAIL_READ_STEP = 6;

const NOTES_SCRIPT: ReadonlyArray<CursorStep<'rest' | 'markAll'>> = [
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'markAll' },
	{ at: 'markAll', press: true },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' }
];
const NOTES_READ_STEP = 8;

const LATER_SCRIPT: ReadonlyArray<{ open: number | null; key?: 'j' | 'k' | 'e' | 'd' }> = [
	{ open: null },
	{ open: 0, key: 'j' },
	{ open: 1, key: 'j' },
	{ open: 1 },
	{ open: 1, key: 'e' },
	{ open: null },
	{ open: null },
	{ open: 0, key: 'j' },
	{ open: 0 },
	{ open: 0 },
	{ open: 0 },
	{ open: null }
];
const ARCHIVED_ROW = 1;
const ARCHIVE_STEP = 4;
const TOAST_LAST_STEP = 8;

@Component({
	selector: 'ngx-inbox-welcome',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe],
	template: `
		<div class="welcome-inner">
			<header class="welcome-head">
				<h3>{{ headKey() + '.TITLE' | translate }}</h3>
				<p>{{ headKey() + '.TEXT' | translate }}</p>
			</header>

			<div class="tiles">
				<section class="tile wide">
					<div class="tile-inner">
						<div class="tile-text">
							<h4>{{ 'INBOX.TABS.decisions' | translate }}</h4>
							<p>{{ 'INBOX.WELCOME.DECISIONS_TEXT' | translate }}</p>
							<div class="tile-cta">
								<button type="button" class="button primary" data-test="welcome-decisions" (click)="openTab.emit('decisions')">
									<nb-icon icon="checkmark-square-2-outline"></nb-icon>
									{{ 'INBOX.WELCOME.OPEN_DECISIONS' | translate }}
								</button>
								<p class="kinds">
									<span>{{ 'INBOX.WELCOME.KINDS' | translate }}</span>
									@for (kind of decisionKinds; track kind) {
										<strong><nb-icon [icon]="kindIcon(kind)"></nb-icon> {{ 'INBOX.KIND.' + kind | translate }}</strong>
									}
								</p>
							</div>
						</div>
						<div class="tile-art dotted" aria-hidden="true">
							<div class="mock window">
								<div class="mock-bar">
									<nb-icon icon="checkmark-square-2-outline"></nb-icon>
									<i class="line w30"></i>
									<span class="spacer"></span>
									<i class="line time"></i>
								</div>
								<div class="decision">
									<div class="decision-head">
										<span class="chip"></span>
										<span class="spacer"></span>
										<span class="dot mini" data-tone="2"></span>
									</div>
									<i class="line strong w70"></i>
									<i class="line w90"></i>
									<i class="line w60"></i>
									@if (answered()) {
										<div class="answered">
											<span class="answered-line"><nb-icon icon="checkmark-circle-2-outline"></nb-icon><i class="line"></i></span>
											<i class="line w45"></i>
										</div>
									} @else {
										<div class="choices">
											<span
												class="choice"
												[class.is-chosen]="approveChosen()"
												[class.is-pressed]="decisionCursor().at === 'approve' && !!decisionCursor().press"
											>
												<span class="choice-dot"></span><i class="line"></i>
											</span>
											<span class="choice"><span class="choice-dot"></span><i class="line"></i></span>
										</div>
										<div class="composer">
											<span class="note"><i class="line w40"></i></span>
											<span
												class="send"
												[class.is-ready]="approveChosen()"
												[class.is-pressed]="decisionCursor().at === 'send' && !!decisionCursor().press"
											>
												<nb-icon icon="paper-plane-outline"></nb-icon>
											</span>
										</div>
									}
								</div>
								<span class="cursor" [attr.data-at]="decisionCursor().at" [class.is-pressing]="!!decisionCursor().press">
									<svg class="cursor-arrow" viewBox="0 0 20 20"><path d="M3 2.5 16.5 9l-5.75 1.75L8 16.5Z" /></svg>
									<span class="cursor-label">{{ 'INBOX.WELCOME.YOU' | translate }}</span>
								</span>
							</div>
						</div>
					</div>
				</section>

				@if (emailAvailable()) {
					<section class="tile">
						<div class="tile-inner">
							<div class="tile-text">
								<h4>{{ 'INBOX.TABS.email' | translate }}</h4>
								<p>{{ 'INBOX.WELCOME.EMAIL_TEXT' | translate }}</p>
							</div>
							<div class="tile-row">
								<nb-icon icon="email-outline"></nb-icon>
								<span>{{ 'INBOX.WELCOME.EMAIL_LABEL' | translate }}</span>
								<button
									type="button"
									class="button"
									data-test="welcome-email"
									[attr.aria-label]="'INBOX.WELCOME.OPEN_TAB_LABEL' | translate: { tab: ('INBOX.TABS.email' | translate) }"
									(click)="openTab.emit('email')"
								>
									{{ 'INBOX.WELCOME.OPEN' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon>
								</button>
							</div>
							<div class="tile-art bottom" aria-hidden="true">
								<div class="mock mail">
									@if (mailPill()) {
										<span class="new-pill" [class.is-pressed]="mailCursor().at === 'pill' && !!mailCursor().press">
											<nb-icon icon="arrow-upward-outline"></nb-icon><i class="line"></i>
										</span>
									}
									@if (mailShown()) {
										<div
											class="mail-row is-new"
											[class.unread]="!mailRead()"
											[class.is-open]="mailRead()"
											[class.is-pressed]="mailCursor().at === 'row' && !!mailCursor().press"
										>
											<span class="dot" data-tone="3"></span>
											<span class="mock-lines">
												<span class="name-row"><i class="line strong w35"></i><i class="line time"></i></span>
												<i class="line w80"></i>
											</span>
											<span class="unread-dot"></span>
										</div>
									}
									@for (row of mailRows; track $index) {
										<div class="mail-row" [class.unread]="row.unread">
											<span class="dot" [attr.data-tone]="row.tone"></span>
											<span class="mock-lines">
												<span class="name-row"><i class="line strong" [style.width.%]="row.name"></i><i class="line time"></i></span>
												<i class="line" [style.width.%]="row.text"></i>
											</span>
											<span class="unread-dot"></span>
										</div>
									}
									<span class="cursor" [attr.data-at]="mailCursor().at" [class.is-pressing]="!!mailCursor().press">
										<svg class="cursor-arrow" viewBox="0 0 20 20"><path d="M3 2.5 16.5 9l-5.75 1.75L8 16.5Z" /></svg>
										<span class="cursor-label">{{ 'INBOX.WELCOME.YOU' | translate }}</span>
									</span>
								</div>
							</div>
						</div>
					</section>
				}

				<section class="tile" [class.full]="!emailAvailable()">
					<div class="tile-inner">
						<div class="tile-text">
							<h4>{{ 'INBOX.TABS.notifications' | translate }}</h4>
							<p>{{ 'INBOX.WELCOME.NOTIFICATIONS_TEXT' | translate }}</p>
						</div>
						<div class="tile-row">
							<nb-icon icon="bell-outline"></nb-icon>
							<span>{{ 'INBOX.WELCOME.NOTIFICATIONS_LABEL' | translate }}</span>
							<button
								type="button"
								class="button"
								data-test="welcome-notifications"
								[attr.aria-label]="'INBOX.WELCOME.OPEN_TAB_LABEL' | translate: { tab: ('INBOX.TABS.notifications' | translate) }"
								(click)="openTab.emit('notifications')"
							>
								{{ 'INBOX.WELCOME.OPEN' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon>
							</button>
						</div>
						<div class="tile-art bottom" aria-hidden="true">
							<div class="mock notes">
								<div class="notes-bar">
									@if (notesRead()) {
										<span class="caught-up"><nb-icon icon="checkmark-outline"></nb-icon><i class="line"></i></span>
									} @else {
										<span class="unread-summary"><i class="line strong"></i><span class="count-chip"></span></span>
									}
									<span class="spacer"></span>
									<span class="mark-all" [class.is-pressed]="notesCursor().at === 'markAll' && !!notesCursor().press">
										<nb-icon icon="done-all-outline"></nb-icon><i class="line"></i>
									</span>
								</div>
								@for (note of notes; track $index) {
									<div class="note-row" [class.unread]="note.unread && !notesRead()">
										<span class="note-icon"><nb-icon [icon]="note.icon"></nb-icon></span>
										<span class="mock-lines">
											<span class="name-row"><i class="line strong" [style.width.%]="note.name"></i><i class="line time"></i></span>
											<i class="line" [style.width.%]="note.text"></i>
										</span>
										<span class="unread-dot"></span>
									</div>
								}
								<span class="cursor" [attr.data-at]="notesCursor().at" [class.is-pressing]="!!notesCursor().press">
									<svg class="cursor-arrow" viewBox="0 0 20 20"><path d="M3 2.5 16.5 9l-5.75 1.75L8 16.5Z" /></svg>
									<span class="cursor-label">{{ 'INBOX.WELCOME.YOU' | translate }}</span>
								</span>
							</div>
						</div>
					</div>
				</section>

				<section class="tile wide">
					<div class="tile-inner">
						<div class="tile-text">
							<h4>{{ 'INBOX.WELCOME.LATER_TITLE' | translate }}</h4>
							<p>{{ 'INBOX.WELCOME.LATER_TEXT' | translate }}</p>
							<div class="tile-cta">
								<div class="tab-buttons">
									@for (entry of laterTabs; track entry) {
										<button
											type="button"
											class="button"
											[attr.data-test]="'welcome-' + entry"
											[attr.aria-label]="'INBOX.WELCOME.OPEN_TAB_LABEL' | translate: { tab: ('INBOX.TABS.' + entry | translate) }"
											(click)="openTab.emit(entry)"
										>
											<nb-icon [icon]="tabIcons[entry]"></nb-icon>
											{{ 'INBOX.TABS.' + entry | translate }}
										</button>
									}
								</div>
								<button type="button" class="link-button" data-test="welcome-shortcuts" (click)="openShortcuts.emit()">
									<nb-icon icon="keypad-outline"></nb-icon>
									{{ 'INBOX.SHORTCUTS.TITLE' | translate }}
									<kbd>?</kbd>
								</button>
							</div>
						</div>
						<div class="tile-art dotted" aria-hidden="true">
							<div class="mock window later">
								<div class="mock-bar">
									<nb-icon icon="inbox-outline"></nb-icon>
									<i class="line w30"></i>
								</div>
								<div class="later-rows">
									@for (row of laterRows(); track row.id) {
										<div class="later-row" [class.is-open]="row.id === laterStep().open" [class.is-leaving]="row.id === leavingRow()">
											<span class="dot mini" [attr.data-tone]="row.tone"></span>
											<i class="line" [style.width.%]="row.width"></i>
										</div>
									}
								</div>
								<div class="toast-slot">
									@if (toastShown()) {
										<span class="toast">
											<span>{{ 'INBOX.UNDO.ARCHIVED' | translate: { count: 1 } }}</span>
											<span class="toast-undo">{{ 'INBOX.UNDO.ACTION' | translate }}</span>
										</span>
									}
								</div>
								<div class="keycaps">
									@for (key of keys; track key) {
										<kbd [class.is-pressed]="laterStep().key === key">{{ key }}</kbd>
									}
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
				flex: 1 1 auto;
				min-height: 0;
				height: 100%;
				overflow-y: auto;
				container-type: inline-size;
				--w-bg: var(--background-basic-color-1);
				--w-surface: color-mix(in srgb, var(--text-basic-color) 3.5%, var(--background-basic-color-1));
				--w-border: var(--gauzy-border-default-color, var(--border-basic-color-3));
				--w-border-strong: var(--border-basic-color-4);
				--w-line: var(--gauzy-active-tint, var(--background-basic-color-4));
				--w-hover: var(--gauzy-hover-tint, var(--background-basic-color-3));
				--w-text: var(--text-basic-color);
				--w-muted: var(--text-hint-color);
				--w-accent: var(--color-primary-default);
				--w-accent-soft: var(--color-primary-transparent-200);
				--w-on-accent: var(--text-control-color);
				--w-success: var(--color-success-default);
			}
			.welcome-inner {
				max-width: 60rem;
				margin: 0 auto;
				padding: 2.5rem 1.75rem 2rem;
			}
			.welcome-head {
				margin-bottom: 1.5rem;
				text-align: start;
			}
			.welcome-head h3 {
				margin: 0;
				color: var(--w-text);
				font-size: 1.375rem;
				font-weight: 500;
				line-height: 1.3;
				letter-spacing: -0.01em;
			}
			.welcome-head p {
				margin: 0.375rem 0 0;
				color: var(--w-muted);
				font-size: 0.875rem;
			}

			.tiles {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 1.25rem;
			}
			.tile {
				padding: 0.375rem;
				border: 1px solid var(--w-border);
				border-radius: calc(var(--border-radius) * 3);
			}
			.tile.wide,
			.tile.full {
				grid-column: 1 / -1;
			}
			.tile-inner {
				position: relative;
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 20rem;
				overflow: hidden;
				contain: layout paint;
				border: 1px solid var(--w-border);
				border-radius: calc(var(--border-radius) * 2.25);
				background: var(--w-surface);
			}
			.tile.wide .tile-inner {
				display: grid;
				grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
				min-height: 18rem;
			}
			.tile-text {
				display: flex;
				flex-direction: column;
				padding: 2rem 2rem 0;
			}
			.tile.wide .tile-text {
				padding-bottom: 2rem;
			}
			.tile-text h4 {
				margin: 0;
				color: var(--w-text);
				font-size: 1.25rem;
				font-weight: 600;
				line-height: 1.3;
			}
			.tile-text p {
				max-width: 32rem;
				margin: 0.5rem 0 0;
				color: var(--w-muted);
				font-size: 0.9375rem;
				line-height: 1.6;
			}
			.tile-cta {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 1.25rem;
				margin-top: auto;
				padding-top: 1.75rem;
			}
			.tile-text p.kinds {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 1rem;
				margin: 0;
				font-size: 0.875rem;
			}
			.kinds strong {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				color: var(--w-text);
				font-weight: 500;
			}
			.kinds nb-icon {
				font-size: 1rem;
			}
			.tile-row {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin: 1.5rem 2rem 0;
				color: var(--w-text);
				font-size: 0.9375rem;
				font-weight: 500;
			}
			.tile-row > nb-icon {
				font-size: 1.25rem;
			}
			.tile-row > span {
				flex: 1 1 auto;
				min-width: 0;
			}
			.tab-buttons {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
			}

			.button {
				display: inline-flex;
				align-items: center;
				flex: 0 0 auto;
				gap: 0.5rem;
				height: 2.5rem;
				padding: 0 1.125rem;
				border: 0;
				border-radius: var(--border-radius);
				background: var(--w-hover);
				color: var(--w-text);
				font: inherit;
				font-size: 0.9375rem;
				font-weight: 500;
				cursor: pointer;
				transition: background-color 0.1s ease, opacity 0.1s ease;
			}
			.button nb-icon {
				font-size: 1rem;
			}
			.button:hover {
				background: var(--w-line);
			}
			.button.primary,
			.button.primary:hover {
				background: var(--w-text);
				color: var(--w-bg);
			}
			.button.primary:hover {
				opacity: 0.88;
			}
			.link-button {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0;
				border: 0;
				background: none;
				color: var(--w-muted);
				font: inherit;
				font-size: 0.875rem;
				font-weight: 500;
				cursor: pointer;
			}
			.link-button:hover {
				color: var(--w-text);
			}
			.link-button nb-icon {
				font-size: 1rem;
			}
			.button:focus-visible,
			.link-button:focus-visible {
				outline: 2px solid var(--w-accent);
				outline-offset: 2px;
			}

			.tile-art {
				position: relative;
				display: flex;
				justify-content: center;
				min-width: 0;
				pointer-events: none;
			}
			.tile-art.dotted {
				align-items: flex-end;
				padding: 2.5rem 2.25rem 0;
				background-image: radial-gradient(var(--w-border-strong) 1px, transparent 1.5px);
				background-size: 1.125rem 1.125rem;
				background-position: center;
			}
			.tile-art.bottom {
				flex: 1 1 auto;
				align-items: flex-end;
				margin-top: 2rem;
				padding: 0 2rem;
			}
			.mock {
				position: relative;
				contain: layout;
				width: 100%;
				max-width: 22rem;
				margin-bottom: -1px;
				border: 1px solid var(--w-border-strong);
				border-bottom: 0;
				border-radius: calc(var(--border-radius) * 2) calc(var(--border-radius) * 2) 0 0;
				background: var(--w-bg);
				box-shadow: var(--gauzy-shadow);
			}
			.mock.window {
				border-radius: calc(var(--border-radius) * 1.75) calc(var(--border-radius) * 1.75) 0 0;
			}
			.line {
				display: block;
				height: 0.5rem;
				border-radius: 999px;
				background: var(--w-line);
			}
			.line.strong {
				height: 0.5625rem;
				background: var(--w-border-strong);
			}
			.line.time {
				width: 1.75rem;
				height: 0.375rem;
				flex: 0 0 auto;
				opacity: 0.7;
			}
			.w30 {
				width: 30%;
			}
			.w35 {
				width: 35%;
			}
			.w40 {
				width: 40%;
			}
			.w45 {
				width: 45%;
			}
			.w60 {
				width: 60%;
			}
			.w70 {
				width: 70%;
			}
			.w80 {
				width: 80%;
			}
			.w90 {
				width: 90%;
			}
			.spacer {
				flex: 1 1 auto;
			}
			.dot {
				width: 1.5rem;
				height: 1.5rem;
				flex: 0 0 auto;
				border-radius: var(--border-radius);
				background: var(--w-accent);
			}
			.dot.mini {
				width: 1rem;
				height: 1rem;
				border-radius: calc(var(--border-radius) * 0.625);
			}
			.dot[data-tone='2'] {
				background: var(--w-success);
			}
			.dot[data-tone='3'] {
				background: var(--color-warning-default);
			}
			.mock-bar {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.75rem 1rem;
				border-bottom: 1px solid var(--w-border);
				color: var(--w-muted);
			}
			.mock-bar nb-icon {
				font-size: 1rem;
				color: var(--w-text);
			}
			.mock-lines {
				display: flex;
				flex-direction: column;
				gap: 0.4375rem;
				flex: 1 1 auto;
				min-width: 0;
				padding-top: 0.1875rem;
			}
			.name-row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.unread-dot {
				width: 0.5rem;
				height: 0.5rem;
				flex: 0 0 auto;
				margin-top: 0.375rem;
				border-radius: 50%;
				background: var(--w-accent);
				opacity: 0;
				transition: opacity 0.3s ease;
			}
			.unread .unread-dot {
				opacity: 1;
			}
			.unread .line.strong {
				background: var(--w-muted);
			}

			.decision {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				padding: 1rem 1rem 1.25rem;
			}
			.decision-head {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				height: 1.25rem;
				margin-bottom: 0.25rem;
			}
			.chip {
				width: 4.5rem;
				height: 1.25rem;
				border-radius: 999px;
				background: var(--w-accent-soft);
			}
			.choices {
				display: flex;
				gap: 0.5rem;
				height: 1.75rem;
				margin-top: 0.5rem;
			}
			.choice {
				position: relative;
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				width: 5.5rem;
				height: 1.75rem;
				padding: 0 0.625rem;
				border: 1px solid var(--w-border-strong);
				border-radius: var(--border-radius);
				transition: border-color 0.2s ease;
			}
			.choice .line {
				flex: 1 1 auto;
			}
			.choice-dot {
				width: 0.625rem;
				height: 0.625rem;
				flex: 0 0 auto;
				border: 1px solid var(--w-border-strong);
				border-radius: 50%;
				transition: background-color 0.2s ease, border-color 0.2s ease;
			}
			.choice.is-chosen {
				border-color: var(--w-accent);
			}
			.choice.is-chosen .choice-dot {
				border-color: var(--w-accent);
				background: var(--w-accent);
			}
			.composer {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				height: 2rem;
			}
			.note {
				display: flex;
				align-items: center;
				flex: 1 1 auto;
				height: 2rem;
				padding: 0 0.625rem;
				border: 1px solid var(--w-border);
				border-radius: var(--border-radius);
			}
			.send {
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 3rem;
				height: 2rem;
				flex: 0 0 auto;
				border-radius: var(--border-radius);
				background: var(--w-line);
				color: var(--w-muted);
				transition: background-color 0.2s ease, color 0.2s ease;
			}
			.send.is-ready {
				background: var(--w-accent);
				color: var(--w-on-accent);
			}
			.send nb-icon {
				font-size: 0.875rem;
			}
			.answered {
				display: flex;
				flex-direction: column;
				justify-content: center;
				gap: 0.625rem;
				height: 4.25rem;
				margin-top: 0.5rem;
				animation: welcome-rise 0.35s ease-out both;
			}
			.answered-line {
				display: inline-flex;
				align-items: center;
				align-self: flex-start;
				gap: 0.5rem;
				height: 1.75rem;
				padding: 0 0.75rem;
				border-radius: var(--border-radius);
				background: color-mix(in srgb, var(--w-success) 14%, transparent);
				color: var(--w-success);
			}
			.answered-line nb-icon {
				font-size: 1rem;
			}
			.answered-line .line {
				width: 5rem;
				background: currentColor;
				opacity: 0.45;
			}

			.mock.mail,
			.mock.notes {
				display: flex;
				flex-direction: column;
				height: 12.5rem;
			}
			.mock.mail {
				gap: 0.125rem;
				padding: 0.5rem;
			}
			.new-pill {
				position: relative;
				display: inline-flex;
				align-items: center;
				align-self: center;
				gap: 0.375rem;
				height: 1.5rem;
				margin: 0.125rem 0 0.25rem;
				padding: 0 0.75rem;
				border-radius: 999px;
				background: var(--w-accent);
				color: var(--w-on-accent);
				animation: welcome-rise 0.35s ease-out both;
			}
			.new-pill nb-icon {
				font-size: 0.75rem;
			}
			.new-pill .line {
				width: 3rem;
				height: 0.375rem;
				background: currentColor;
				opacity: 0.6;
			}
			.mail-row {
				position: relative;
				display: flex;
				align-items: flex-start;
				flex: 0 0 auto;
				gap: 0.625rem;
				padding: 0.625rem;
				border-radius: var(--border-radius);
				transition: background-color 0.3s ease;
			}
			.mail-row.is-new {
				animation: welcome-rise 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;
			}
			.mail-row.is-open {
				background: var(--w-hover);
			}

			.notes-bar {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.625rem 0.75rem;
				border-bottom: 1px solid var(--w-border);
			}
			.unread-summary {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
			}
			.unread-summary .line {
				width: 4rem;
			}
			.count-chip {
				width: 1.25rem;
				height: 1rem;
				border-radius: 999px;
				background: var(--w-accent);
			}
			.caught-up {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				color: var(--w-success);
				animation: welcome-rise 0.35s ease-out both;
			}
			.caught-up nb-icon {
				font-size: 0.875rem;
			}
			.caught-up .line {
				width: 4rem;
				background: currentColor;
				opacity: 0.45;
			}
			.mark-all {
				position: relative;
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				height: 1.5rem;
				padding: 0 0.625rem;
				border-radius: var(--border-radius);
				background: var(--w-hover);
				color: var(--w-text);
			}
			.mark-all nb-icon {
				font-size: 0.875rem;
			}
			.mark-all .line {
				width: 2.25rem;
				height: 0.375rem;
			}
			.note-row {
				display: flex;
				align-items: flex-start;
				flex: 0 0 auto;
				gap: 0.625rem;
				padding: 0.625rem 0.75rem;
			}
			.note-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				flex: 0 0 auto;
				border-radius: 50%;
				background: var(--w-accent-soft);
				color: var(--w-accent);
			}
			.note-icon nb-icon {
				font-size: 0.875rem;
			}

			.mock.later {
				display: flex;
				flex-direction: column;
			}
			.later-rows {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				height: 8.25rem;
				padding: 0.75rem;
				overflow: hidden;
			}
			.later-row {
				position: relative;
				display: flex;
				align-items: center;
				flex: 0 0 auto;
				gap: 0.625rem;
				height: 1.75rem;
				padding: 0 0.625rem;
				border-radius: var(--border-radius);
				transition: background-color 0.25s ease;
			}
			.later-row::before {
				content: '';
				position: absolute;
				inset: 0.375rem auto 0.375rem 0;
				width: 2px;
				border-radius: 1px;
				background: var(--w-accent);
				opacity: 0;
				transition: opacity 0.25s ease;
			}
			.later-row.is-open {
				background: var(--w-hover);
			}
			.later-row.is-open::before {
				opacity: 1;
			}
			.later-row.is-leaving {
				animation: welcome-leave 0.5s ease-in forwards;
			}
			.toast-slot {
				display: flex;
				justify-content: center;
				align-items: center;
				height: 2.25rem;
				padding: 0 0.75rem;
			}
			.toast {
				display: inline-flex;
				align-items: center;
				gap: 0.75rem;
				height: 1.75rem;
				padding: 0 0.75rem;
				border-radius: var(--border-radius);
				background: var(--tooltip-background-color);
				color: var(--tooltip-text-color);
				font-size: 0.75rem;
				white-space: nowrap;
				box-shadow: var(--gauzy-shadow);
				animation: welcome-rise 0.3s ease-out both;
			}
			.toast-undo {
				font-weight: 600;
			}
			.keycaps {
				display: flex;
				gap: 0.375rem;
				padding: 0.625rem 0.75rem 0.75rem;
				border-top: 1px solid var(--w-border);
			}
			kbd {
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.75rem;
				height: 1.75rem;
				padding: 0 0.375rem;
				border: 1px solid var(--w-border-strong);
				border-bottom-width: 2px;
				border-radius: calc(var(--border-radius) * 0.75);
				background: var(--w-bg);
				color: var(--w-text);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				transition: transform 0.15s ease, color 0.15s ease, border-color 0.15s ease;
			}
			.link-button kbd {
				min-width: 1.375rem;
				height: 1.375rem;
				color: var(--w-muted);
			}
			kbd.is-pressed {
				border-color: var(--w-accent);
				color: var(--w-accent);
				transform: translateY(1px);
			}

			.choice.is-pressed::after,
			.send.is-pressed::after,
			.new-pill.is-pressed::after,
			.mail-row.is-pressed::after,
			.mark-all.is-pressed::after,
			kbd.is-pressed::after {
				content: '';
				position: absolute;
				inset: 0;
				border-radius: inherit;
				box-shadow: 0 0 0 3px var(--w-accent-soft);
				pointer-events: none;
				animation: welcome-ring 0.7s ease-out forwards;
			}

			.cursor {
				position: absolute;
				inset: 0;
				z-index: 2;
				display: flex;
				align-items: flex-start;
				pointer-events: none;
				transform: translate(calc(var(--x, 0px) * var(--flip, 1)), var(--y, 0px));
				transition: transform 0.9s cubic-bezier(0.65, 0, 0.35, 1);
			}
			:host-context([dir='rtl']) .cursor {
				--flip: -1;
			}
			.window .cursor[data-at='rest'] {
				--x: 62%;
				--y: 4.5rem;
			}
			.window .cursor[data-at='approve'] {
				--x: 3.25rem;
				--y: 9.75rem;
			}
			.window .cursor[data-at='send'] {
				--x: calc(100% - 2.85rem);
				--y: 12.05rem;
			}
			.mail .cursor[data-at='rest'] {
				--x: 70%;
				--y: 7.5rem;
			}
			.mail .cursor[data-at='pill'] {
				--x: 52%;
				--y: 1.05rem;
			}
			.mail .cursor[data-at='row'] {
				--x: 42%;
				--y: 1.65rem;
			}
			.notes .cursor[data-at='rest'] {
				--x: 56%;
				--y: 7.25rem;
			}
			.notes .cursor[data-at='markAll'] {
				--x: calc(100% - 3.1rem);
				--y: 1.05rem;
			}
			.cursor-arrow {
				flex: 0 0 auto;
				width: 1.125rem;
				height: 1.125rem;
				overflow: visible;
				transform-origin: 3px 2.5px;
				fill: var(--w-accent);
				stroke: var(--w-on-accent);
				stroke-width: 1.5;
				stroke-linejoin: round;
			}
			.cursor-label {
				margin-top: 0.875rem;
				margin-inline-start: -0.25rem;
				padding: 0.125rem 0.5rem;
				border-radius: calc(var(--border-radius) * 0.75);
				background: var(--w-accent);
				color: var(--w-on-accent);
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1rem;
				white-space: nowrap;
				box-shadow: var(--gauzy-shadow);
			}
			.cursor.is-pressing .cursor-arrow {
				animation: welcome-press 0.35s ease-out;
			}

			.welcome-head,
			.tile {
				animation: welcome-rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
			}
			.tile:nth-child(1) {
				animation-delay: 0.06s;
			}
			.tile:nth-child(2) {
				animation-delay: 0.12s;
			}
			.tile:nth-child(3) {
				animation-delay: 0.18s;
			}
			.tile:nth-child(4) {
				animation-delay: 0.24s;
			}
			@keyframes welcome-rise {
				from {
					opacity: 0;
					transform: translateY(0.75rem);
				}
				to {
					opacity: 1;
					transform: none;
				}
			}
			@keyframes welcome-leave {
				to {
					opacity: 0;
					transform: translateX(1.5rem);
				}
			}
			@keyframes welcome-press {
				40% {
					transform: scale(0.8);
				}
				100% {
					transform: scale(1);
				}
			}
			@keyframes welcome-ring {
				from {
					opacity: 1;
					transform: scale(1);
				}
				to {
					opacity: 0;
					transform: scale(1.35);
				}
			}
			@media (prefers-reduced-motion: reduce) {
				:host *,
				:host *::after,
				:host *::before {
					animation: none !important;
					transition: none !important;
				}
				.cursor {
					display: none;
				}
			}
			@container (max-width: 44rem) {
				.welcome-inner {
					padding: 2rem 1rem;
				}
				.tiles {
					grid-template-columns: minmax(0, 1fr);
				}
				.tile.wide .tile-inner {
					grid-template-columns: minmax(0, 1fr);
				}
				.tile.wide .tile-text {
					padding-bottom: 0;
				}
				.tile-text {
					padding: 1.5rem 1.5rem 0;
				}
				.tile-row {
					margin: 1.25rem 1.5rem 0;
				}
				.tile-art.dotted {
					padding: 2rem 1.5rem 0;
				}
				.tile-art.bottom {
					padding: 0 1.5rem;
				}
			}
		`
	]
})
export class InboxWelcomeComponent {
	private readonly zone = inject(NgZone);
	private readonly destroyRef = inject(DestroyRef);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly openTab = output<InboxUiTab>();
	readonly openShortcuts = output<void>();
	readonly emailAvailable = input(false);
	readonly tab = input<InboxUiTab>('all');

	protected readonly headKey = computed(() => `INBOX.WELCOME.HEAD.${this.tab() === 'notifications' ? 'all' : this.tab()}`);

	protected readonly decisionKinds = [InboxItemKindEnum.QUESTION, InboxItemKindEnum.APPROVAL, InboxItemKindEnum.ESCALATION];
	protected readonly laterTabs: readonly InboxUiTab[] = ['snoozed', 'done', 'archived'];
	protected readonly tabIcons = INBOX_UI_TAB_ICONS;
	protected readonly keys = ['j', 'k', 'e', 'd'] as const;
	protected readonly mailRows = [
		{ tone: 1, name: 30, text: 72, unread: true },
		{ tone: 2, name: 24, text: 58, unread: false },
		{ tone: 1, name: 34, text: 66, unread: false }
	];
	protected readonly notes = [
		{ icon: 'at-outline', name: 34, text: 70, unread: true },
		{ icon: 'person-add-outline', name: 28, text: 58, unread: true },
		{ icon: 'message-circle-outline', name: 32, text: 64, unread: false },
		{ icon: 'calendar-outline', name: 26, text: 52, unread: false }
	];
	private readonly allLaterRows = [
		{ id: 0, tone: 1, width: 62 },
		{ id: 1, tone: 3, width: 48 },
		{ id: 2, tone: 2, width: 70 },
		{ id: 3, tone: 1, width: 54 }
	];

	private readonly step = signal(0);
	private readonly reducedMotion = signal(false);

	private readonly playing = (from: number) => this.step() >= from && this.step() < RESET_STEP;

	protected readonly decisionCursor = computed(() => DECISION_SCRIPT[this.step()]);
	protected readonly approveChosen = computed(() => this.playing(APPROVE_CHOSEN_STEP));
	protected readonly answered = computed(() => this.playing(ANSWERED_STEP));

	protected readonly mailCursor = computed(() => MAIL_SCRIPT[this.step()]);
	protected readonly mailPill = computed(() => this.step() >= MAIL_PILL_STEP && this.step() < MAIL_SHOWN_STEP);
	protected readonly mailShown = computed(() => this.playing(MAIL_SHOWN_STEP));
	protected readonly mailRead = computed(() => this.playing(MAIL_READ_STEP));

	protected readonly notesCursor = computed(() => NOTES_SCRIPT[this.step()]);
	protected readonly notesRead = computed(() => this.playing(NOTES_READ_STEP));

	protected readonly laterStep = computed(() => LATER_SCRIPT[this.step()]);
	protected readonly leavingRow = computed(() => (this.step() === ARCHIVE_STEP ? ARCHIVED_ROW : null));
	protected readonly laterRows = computed(() =>
		this.playing(ARCHIVE_STEP + 1) ? this.allLaterRows.filter((row) => row.id !== ARCHIVED_ROW) : this.allLaterRows
	);
	protected readonly toastShown = computed(() => this.step() >= ARCHIVE_STEP && this.step() <= TOAST_LAST_STEP);

	constructor() {
		if (typeof window === 'undefined') return;
		const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		if (motion) {
			this.reducedMotion.set(motion.matches);
			const onMotionChange = (event: MediaQueryListEvent) => this.reducedMotion.set(event.matches);
			motion.addEventListener('change', onMotionChange);
			this.destroyRef.onDestroy(() => motion.removeEventListener('change', onMotionChange));
		}
		effect((onCleanup) => {
			this.step.set(0);
			if (this.reducedMotion()) return;
			const timer = this.zone.runOutsideAngular(() =>
				setInterval(() => {
					const hidden = typeof document !== 'undefined' && document.hidden;
					if (hidden || this.host.nativeElement.checkVisibility?.() === false) return;
					this.step.update((step) => (step + 1) % LOOP_SECONDS);
				}, 1000)
			);
			onCleanup(() => clearInterval(timer));
		});
	}

	protected kindIcon(kind: InboxItemKindEnum): string {
		return kindIconOf(kind);
	}
}
