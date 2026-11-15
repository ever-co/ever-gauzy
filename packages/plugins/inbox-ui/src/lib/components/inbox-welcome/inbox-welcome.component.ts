import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, NgZone, output, signal } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { InboxItemKindEnum } from '@gauzy/contracts';
import { InboxUiTab, kindIconOf } from '../../inbox-ui.helpers';

const LOOP_SECONDS = 12;
const RESET_STEP = LOOP_SECONDS - 1;

const DECISION_SCRIPT: ReadonlyArray<{ at: 'rest' | 'approve'; press?: boolean }> = [
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'approve' },
	{ at: 'approve' },
	{ at: 'approve', press: true },
	{ at: 'approve' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' },
	{ at: 'rest' }
];
const APPROVED_STEP = 5;

const MAIL_ARRIVES_STEP = 2;
const MAIL_READ_STEP = 8;

const KEY_SCRIPT: ReadonlyArray<{ selected: number; key?: 'j' | 'k' | 'e' }> = [
	{ selected: 0 },
	{ selected: 0 },
	{ selected: 1, key: 'j' },
	{ selected: 2, key: 'j' },
	{ selected: 2 },
	{ selected: 2, key: 'e' },
	{ selected: 3 },
	{ selected: 3 },
	{ selected: 3 },
	{ selected: 1, key: 'k' },
	{ selected: 1 },
	{ selected: 0 }
];
const ARCHIVED_ROW = 2;
const ARCHIVE_STEP = 5;

@Component({
	selector: 'ngx-inbox-welcome',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe],
	template: `
		<div class="welcome-inner">
			<header class="welcome-head">
				<h3>{{ 'INBOX.WELCOME.TITLE' | translate }}</h3>
				<p>{{ 'INBOX.SELECT' | translate }}</p>
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
									<div class="decision-actions">
										@if (approved()) {
											<span class="decided"><nb-icon icon="checkmark-circle-2-outline"></nb-icon><i class="line"></i></span>
										} @else {
											<span class="act approve" [class.is-hovered]="decisionCursor().at === 'approve'" [class.is-pressed]="!!decisionCursor().press">
												<nb-icon icon="checkmark-outline"></nb-icon>
											</span>
											<span class="act reject"><nb-icon icon="close-outline"></nb-icon></span>
										}
									</div>
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
									[attr.aria-label]="'INBOX.WELCOME.OPEN_EMAIL_LABEL' | translate"
									(click)="openTab.emit('email')"
								>
									{{ 'INBOX.WELCOME.OPEN' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon>
								</button>
							</div>
							<div class="tile-art bottom" aria-hidden="true">
								<div class="mock mail">
									@if (mailArrived()) {
										<div class="mail-row is-new" [class.unread]="!mailRead()">
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
								</div>
							</div>
						</div>
					</section>
				}

				<section class="tile" [class.full]="!emailAvailable()">
					<div class="tile-inner">
						<div class="tile-text">
							<h4>{{ 'INBOX.SHORTCUTS.TITLE' | translate }}</h4>
							<p>{{ 'INBOX.WELCOME.SHORTCUTS_TEXT' | translate }}</p>
						</div>
						<div class="tile-row">
							<nb-icon icon="keypad-outline"></nb-icon>
							<span>{{ 'INBOX.WELCOME.SHORTCUTS_LABEL' | translate }}</span>
							<button
								type="button"
								class="button"
								data-test="welcome-shortcuts"
								[attr.aria-label]="'INBOX.WELCOME.OPEN_SHORTCUTS_LABEL' | translate"
								(click)="openShortcuts.emit()"
							>
								{{ 'INBOX.WELCOME.OPEN' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon>
							</button>
						</div>
						<div class="tile-art bottom" aria-hidden="true">
							<div class="mock keys">
								<div class="key-rows">
									@for (row of keyRows(); track row.id) {
										<div class="key-row" [class.is-selected]="row.id === keyStep().selected" [class.is-leaving]="row.id === leavingRow()">
											<span class="dot mini" [attr.data-tone]="row.tone"></span>
											<i class="line" [style.width.%]="row.width"></i>
										</div>
									}
								</div>
								<div class="keycaps">
									@for (key of keys; track key) {
										<kbd [class.is-pressed]="keyStep().key === key">{{ key }}</kbd>
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
				min-height: 17rem;
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
			.button:focus-visible {
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
				background: var(--color-success-default);
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
			.decision-actions {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				height: 2rem;
				margin-top: 0.5rem;
			}
			.act {
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 5.5rem;
				height: 2rem;
				border-radius: var(--border-radius);
			}
			.act nb-icon {
				font-size: 1rem;
			}
			.act.approve {
				background: var(--w-accent);
				color: var(--w-on-accent);
				transition: transform 0.2s ease;
			}
			.act.approve.is-hovered {
				transform: scale(1.04);
			}
			.act.reject {
				width: 5rem;
				border: 1px solid var(--w-border-strong);
				color: var(--w-muted);
			}
			.decided {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				height: 2rem;
				padding: 0 0.75rem;
				border-radius: var(--border-radius);
				background: color-mix(in srgb, var(--color-success-default) 14%, transparent);
				color: var(--color-success-default);
				animation: welcome-rise 0.35s ease-out both;
			}
			.decided nb-icon {
				font-size: 1rem;
			}
			.decided .line {
				width: 5rem;
				background: currentColor;
				opacity: 0.45;
			}

			.mock.mail,
			.mock.keys {
				display: flex;
				flex-direction: column;
				height: 12.5rem;
				overflow: hidden;
			}
			.mock.mail {
				gap: 0.125rem;
				padding: 0.5rem;
			}
			.mail-row {
				display: flex;
				align-items: flex-start;
				flex: 0 0 auto;
				gap: 0.625rem;
				padding: 0.625rem;
				border-radius: var(--border-radius);
				transition: background-color 0.3s ease;
			}
			.mail-row.unread .line.strong {
				background: var(--w-muted);
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
			.mail-row.unread .unread-dot {
				opacity: 1;
			}
			.mail-row.is-new {
				animation: welcome-rise 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;
			}
			.mail-row.is-new.unread {
				background: var(--w-hover);
			}

			.mock.keys {
				gap: 0.75rem;
				padding: 0.75rem;
			}
			.key-rows {
				display: flex;
				flex-direction: column;
				flex: 1 1 auto;
				gap: 0.25rem;
				min-height: 0;
				overflow: hidden;
			}
			.key-row {
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
			.key-row::before {
				content: '';
				position: absolute;
				inset: 0.375rem auto 0.375rem 0;
				width: 2px;
				border-radius: 1px;
				background: var(--w-accent);
				opacity: 0;
				transition: opacity 0.25s ease;
			}
			.key-row.is-selected {
				background: var(--w-hover);
			}
			.key-row.is-selected::before {
				opacity: 1;
			}
			.key-row.is-leaving {
				animation: welcome-leave 0.5s ease-in forwards;
			}
			.keycaps {
				display: flex;
				gap: 0.375rem;
				padding-top: 0.625rem;
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
			kbd.is-pressed {
				border-color: var(--w-accent);
				color: var(--w-accent);
				transform: translateY(1px);
			}

			.act.is-pressed::after,
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
			.cursor[data-at='rest'] {
				--x: 60%;
				--y: 4.25rem;
			}
			.cursor[data-at='approve'] {
				--x: 3.375rem;
				--y: 9.75rem;
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
				animation-delay: 0.14s;
			}
			.tile:nth-child(3) {
				animation-delay: 0.22s;
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

	protected readonly decisionKinds = [InboxItemKindEnum.QUESTION, InboxItemKindEnum.APPROVAL, InboxItemKindEnum.ESCALATION];
	protected readonly keys = ['j', 'k', 'e'] as const;
	protected readonly mailRows = [
		{ tone: 1, name: 30, text: 72, unread: true },
		{ tone: 2, name: 24, text: 58, unread: false },
		{ tone: 1, name: 34, text: 66, unread: false }
	];
	private readonly allKeyRows = [
		{ id: 0, tone: 1, width: 62 },
		{ id: 1, tone: 2, width: 48 },
		{ id: 2, tone: 3, width: 70 },
		{ id: 3, tone: 1, width: 54 },
		{ id: 4, tone: 2, width: 44 }
	];

	private readonly step = signal(0);
	private readonly reducedMotion = signal(false);

	protected readonly decisionCursor = computed(() => DECISION_SCRIPT[this.step()]);
	protected readonly approved = computed(() => this.step() >= APPROVED_STEP && this.step() < RESET_STEP);
	protected readonly mailArrived = computed(() => this.step() >= MAIL_ARRIVES_STEP && this.step() < RESET_STEP);
	protected readonly mailRead = computed(() => this.step() >= MAIL_READ_STEP);
	protected readonly keyStep = computed(() => KEY_SCRIPT[this.step()]);
	protected readonly leavingRow = computed(() => (this.step() === ARCHIVE_STEP ? ARCHIVED_ROW : null));
	protected readonly keyRows = computed(() =>
		this.step() > ARCHIVE_STEP && this.step() < RESET_STEP ? this.allKeyRows.filter((row) => row.id !== ARCHIVED_ROW) : this.allKeyRows
	);

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
