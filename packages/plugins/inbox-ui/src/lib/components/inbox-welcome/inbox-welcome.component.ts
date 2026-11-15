import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, NgZone, output, signal } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
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
	imports: [NbButtonModule, NbIconModule, TranslatePipe],
	templateUrl: './inbox-welcome.component.html',
	styleUrl: './inbox-welcome.component.scss'
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
