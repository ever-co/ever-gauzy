import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	inject,
	OnDestroy,
	signal,
	untracked
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { SHORTCUT_SEQUENCE_TIMEOUT_MS } from '../task-views-ui.constants';
import { TaskViewsAvailabilityService } from '../services/task-views-availability.service';
import { commandKey, contextKey } from './shortcut-help-dialog.component';
import { ShortcutKeyCapsComponent } from './shortcut-key-caps.component';
import { ShortcutRecorder } from './shortcut-recorder';
import {
	conflictsOf,
	formatBinding,
	parseBinding,
	refusalOf,
	SHORTCUT_CONTEXTS,
	ShortcutBinding,
	ShortcutCommand
} from './shortcut-registry';
import { ShortcutRegistryService } from './shortcut-registry.service';

/** The i18n key of why a binding is refused. */
export function refusalKey(refusal: string): string {
	return `TASK_VIEWS.SHORTCUTS.REFUSAL.${refusal.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
}

/** A recorded binding about to be saved, with what stands in its way. */
interface Candidate {
	commandId: string;
	binding: ShortcutBinding;
	refusal: string | null;
	conflicts: ShortcutCommand[];
}

/**
 * Settings → Keyboard shortcuts: every command with its binding in force, and for each one that can be changed,
 * Change (record one key, or two in a row), Default and No key. A binding the registry would refuse, or one that
 * clashes with another in force, is shown with why and is not saved. Saved to the person's preferences on the
 * platform (`uiPreferences.keyboard`), so it follows them to every device and to Ever Teams.
 */
@Component({
	selector: 'ngx-task-views-keyboard-settings',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, TranslatePipe, ShortcutKeyCapsComponent],
	templateUrl: './keyboard-settings-page.component.html',
	styleUrl: './keyboard-settings-page.component.scss',
	host: {
		'(window:keydown)': 'onRecordKeydown($event)'
	}
})
export class KeyboardSettingsPageComponent implements OnDestroy {
	private readonly registry = inject(ShortcutRegistryService);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly available = toSignal(inject(TaskViewsAvailabilityService).available$, { initialValue: false });
	protected readonly isMac = this.registry.isMac;
	protected readonly contextKey = contextKey;
	protected readonly commandKey = commandKey;
	protected readonly refusalKey = refusalKey;

	protected readonly saving = signal(false);
	protected readonly recordingId = signal<string | null>(null);
	protected readonly recorded = signal<ShortcutBinding>([]);
	protected readonly candidate = signal<Candidate | null>(null);

	private readonly recorder = new ShortcutRecorder(
		2,
		SHORTCUT_SEQUENCE_TIMEOUT_MS,
		() => Date.now(),
		this.registry.isMac ? 'mac' : 'other'
	);
	private recordTimer: ReturnType<typeof setTimeout> | null = null;

	protected readonly hasOverrides = computed(() => {
		const known = new Set(this.registry.commands.map((command) => command.id));
		return Object.keys(this.registry.overrides()).some((id) => known.has(id));
	});

	protected readonly sections = computed(() => {
		const bindings = this.registry.bindings();
		const overrides = this.registry.overrides();
		return SHORTCUT_CONTEXTS.map((context) => ({
			context,
			rows: this.registry.commands
				.filter((command) => command.context === context)
				.map((command) => {
					const binding = bindings.get(command.id) ?? null;
					const byDefault = formatBinding(parseBinding(command.defaultBinding) ?? []);
					const overridden =
						command.id in overrides &&
						(binding === null ? overrides[command.id] === '' : formatBinding(binding) !== byDefault);
					return { command, binding, overridden };
				})
		}));
	});

	constructor() {
		this.destroyRef.onDestroy(() => this.stopRecording());
		// The views went away (another organization, the switch off): a recording under way ends, so neither the
		// registry nor the Quick Actions stay paused behind a page that no longer offers Cancel.
		effect(() => {
			if (this.available()) return;
			untracked(() => {
				this.stopRecording();
				this.candidate.set(null);
			});
		});
	}

	ngOnDestroy(): void {
		this.stopRecording();
	}

	protected startRecording(commandId: string): void {
		this.candidate.set(null);
		this.recorder.reset();
		this.recorded.set([]);
		this.recordingId.set(commandId);
		this.registry.setPaused(true);
	}

	protected stopRecording(): void {
		if (this.recordTimer) {
			clearTimeout(this.recordTimer);
			this.recordTimer = null;
		}
		this.recorder.reset();
		this.recorded.set([]);
		if (this.recordingId()) {
			this.recordingId.set(null);
			this.registry.setPaused(false);
		}
	}

	/** A key press while recording: taken from the page (and the Quick Actions), and recorded. */
	onRecordKeydown(event: KeyboardEvent): void {
		const commandId = this.recordingId();
		if (!commandId) return;
		event.preventDefault();
		event.stopPropagation();
		const step = this.recorder.press(event);
		if (step.state === 'ignored') return;
		if (this.recordTimer) {
			clearTimeout(this.recordTimer);
			this.recordTimer = null;
		}
		if (step.state === 'cancelled') {
			this.stopRecording();
			return;
		}
		this.recorded.set(step.binding);
		if (step.state === 'done') {
			this.finish(commandId, step.binding);
			return;
		}
		this.recordTimer = setTimeout(() => {
			const timedOut = this.recorder.timeout();
			if (timedOut.state === 'done') this.finish(commandId, timedOut.binding);
			else this.stopRecording();
		}, SHORTCUT_SEQUENCE_TIMEOUT_MS);
	}

	private finish(commandId: string, binding: ShortcutBinding): void {
		this.stopRecording();
		const checked = this.check(commandId, binding);
		if (checked) this.candidate.set(checked);
	}

	/** A recorded binding with what stands in its way against the bindings in force now. */
	private check(commandId: string, binding: ShortcutBinding): Candidate | null {
		const command = this.registry.commands.find((item) => item.id === commandId);
		if (!command) return null;
		return {
			commandId,
			binding,
			refusal: refusalOf(command, binding),
			conflicts: conflictsOf(commandId, binding, this.registry.commands, this.registry.bindings())
		};
	}

	protected conflictNames(commands: ShortcutCommand[]): string {
		return commands.map((command) => this.translate.instant(commandKey(command.id))).join(', ');
	}

	protected async saveCandidate(): Promise<void> {
		const recorded = this.candidate();
		if (!recorded) return;
		// Checked again: the bindings may have changed since it was recorded (Restore all defaults, another tab).
		const candidate = this.check(recorded.commandId, recorded.binding);
		if (!candidate || candidate.refusal || candidate.conflicts.length) {
			this.candidate.set(candidate);
			return;
		}
		// Kept when the save fails, so it can be saved again without recording it again.
		if (await this.save(candidate.commandId, candidate.binding)) this.candidate.set(null);
	}

	/** Saves a binding; answers whether it was saved. */
	protected async save(commandId: string, binding: ShortcutBinding | null | 'default'): Promise<boolean> {
		this.saving.set(true);
		try {
			await this.registry.saveBinding(commandId, binding);
			this.toastr.success('TASK_VIEWS.SHORTCUTS.SAVED');
			return true;
		} catch {
			this.toastr.danger('TASK_VIEWS.SHORTCUTS.FAILED');
			return false;
		} finally {
			this.saving.set(false);
		}
	}

	protected async resetAll(): Promise<void> {
		this.saving.set(true);
		try {
			await this.registry.resetAll();
			this.toastr.success('TASK_VIEWS.SHORTCUTS.SAVED');
		} catch {
			this.toastr.danger('TASK_VIEWS.SHORTCUTS.FAILED');
		} finally {
			this.saving.set(false);
		}
	}
}
