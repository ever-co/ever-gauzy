import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
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
	template: `
		<nb-card class="keyboard-settings" data-test="keyboard-settings" [nbSpinner]="saving()" nbSpinnerSize="small">
			<nb-card-header class="header">
				<div>
					<h4>{{ 'TASK_VIEWS.SHORTCUTS.PAGE_TITLE' | translate }}</h4>
					<p class="intro">{{ 'TASK_VIEWS.SHORTCUTS.PAGE_INTRO' | translate }}</p>
				</div>
				@if (available()) {
					<button
						nbButton
						size="small"
						status="basic"
						type="button"
						data-test="reset-all"
						[disabled]="saving() || !hasOverrides()"
						(click)="resetAll()"
					>
						{{ 'TASK_VIEWS.SHORTCUTS.RESET_ALL' | translate }}
					</button>
				}
			</nb-card-header>
			<nb-card-body>
				@if (!available()) {
					<p class="unavailable" data-test="keyboard-unavailable">
						{{ 'TASK_VIEWS.SHORTCUTS.UNAVAILABLE' | translate }}
					</p>
				} @else {
					@for (section of sections(); track section.context) {
						<section class="section">
							<h5>{{ contextKey(section.context) | translate }}</h5>
							<table class="table">
								<tbody>
									@for (row of section.rows; track row.command.id) {
										<tr
											[attr.data-command]="row.command.id"
											[class.recording]="recordingId() === row.command.id"
										>
											<th scope="row">{{ commandKey(row.command.id) | translate }}</th>
											<td class="binding">
												@if (recordingId() === row.command.id) {
													<span class="recording-hint" role="status" aria-live="polite">
														@if (recorded().length) {
															<ngx-task-views-key-caps
																[binding]="recorded()"
																[isMac]="isMac"
															></ngx-task-views-key-caps>
														} @else {
															{{ 'TASK_VIEWS.SHORTCUTS.RECORD' | translate }}
														}
													</span>
												} @else if (candidate()?.commandId === row.command.id) {
													<ngx-task-views-key-caps
														[binding]="candidate()!.binding"
														[isMac]="isMac"
													></ngx-task-views-key-caps>
												} @else {
													<ngx-task-views-key-caps
														[binding]="row.binding"
														[isMac]="isMac"
													></ngx-task-views-key-caps>
													@if (row.overridden) {
														<span class="badge">{{
															'TASK_VIEWS.SHORTCUTS.CHANGED' | translate
														}}</span>
													}
												}
											</td>
											<td class="actions">
												@if (row.command.fixed) {
													<span class="fixed">{{
														'TASK_VIEWS.SHORTCUTS.FIXED' | translate
													}}</span>
												} @else if (candidate()?.commandId === row.command.id) {
													@if (candidate()!.refusal; as refusal) {
														<span class="problem" role="alert">{{
															refusalKey(refusal) | translate
														}}</span>
													} @else if (candidate()!.conflicts.length) {
														<span class="problem" role="alert">{{
															'TASK_VIEWS.SHORTCUTS.CONFLICT'
																| translate
																	: {
																			commands: conflictNames(
																				candidate()!.conflicts
																			)
																	  }
														}}</span>
													}
													<button
														nbButton
														size="tiny"
														status="primary"
														type="button"
														data-test="save-binding"
														[disabled]="
															!!candidate()!.refusal ||
															candidate()!.conflicts.length > 0 ||
															saving()
														"
														(click)="saveCandidate()"
													>
														{{ 'TASK_VIEWS.SHORTCUTS.SAVE' | translate }}
													</button>
													<button
														nbButton
														size="tiny"
														status="basic"
														type="button"
														(click)="candidate.set(null)"
													>
														{{ 'TASK_VIEWS.SHORTCUTS.CANCEL' | translate }}
													</button>
												} @else if (recordingId() === row.command.id) {
													<span class="hint">{{
														'TASK_VIEWS.SHORTCUTS.RECORD_HINT' | translate
													}}</span>
													<button
														nbButton
														size="tiny"
														status="basic"
														type="button"
														(click)="stopRecording()"
													>
														{{ 'TASK_VIEWS.SHORTCUTS.CANCEL' | translate }}
													</button>
												} @else {
													<button
														nbButton
														size="tiny"
														status="basic"
														type="button"
														data-test="change-binding"
														[disabled]="saving() || !!recordingId()"
														(click)="startRecording(row.command.id)"
													>
														{{ 'TASK_VIEWS.SHORTCUTS.CHANGE' | translate }}
													</button>
													<button
														nbButton
														size="tiny"
														ghost
														type="button"
														[disabled]="saving() || !row.overridden"
														(click)="save(row.command.id, 'default')"
													>
														{{ 'TASK_VIEWS.SHORTCUTS.RESET' | translate }}
													</button>
													<button
														nbButton
														size="tiny"
														ghost
														type="button"
														[disabled]="saving() || !row.binding"
														(click)="save(row.command.id, null)"
													>
														{{ 'TASK_VIEWS.SHORTCUTS.REMOVE' | translate }}
													</button>
												}
											</td>
										</tr>
									}
								</tbody>
							</table>
						</section>
					}
					<p class="note">{{ 'TASK_VIEWS.SHORTCUTS.QUICK_ACTIONS_NOTE' | translate }}</p>
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.header {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 1rem;
			}
			.header h4 {
				margin: 0;
			}
			.intro,
			.note,
			.hint,
			.fixed {
				color: var(--text-hint-color, #8f9bb3);
				font-size: 0.8125rem;
			}
			.intro {
				margin: 0.25rem 0 0;
			}
			.section {
				margin-bottom: 1.5rem;
			}
			h5 {
				margin: 0 0 0.5rem;
				font-size: 0.8125rem;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				color: var(--text-hint-color, #8f9bb3);
			}
			.table {
				width: 100%;
				border-collapse: collapse;
			}
			.table th,
			.table td {
				padding: 0.5rem 0.5rem 0.5rem 0;
				border-bottom: 1px solid var(--border-basic-color-3, #edf1f7);
				vertical-align: middle;
				text-align: left;
				font-weight: normal;
			}
			.table th {
				width: 40%;
			}
			.binding {
				white-space: nowrap;
			}
			.actions {
				text-align: right;
				white-space: nowrap;
			}
			.actions button + button {
				margin-left: 0.25rem;
			}
			tr.recording {
				background: var(--background-basic-color-2, #f7f9fc);
			}
			.badge {
				margin-left: 0.5rem;
				font-size: 0.6875rem;
				text-transform: uppercase;
				color: var(--color-primary-default, #3366ff);
			}
			.problem {
				margin-right: 0.5rem;
				font-size: 0.8125rem;
				color: var(--color-danger-default, #d33);
				white-space: normal;
			}
			.hint {
				margin-right: 0.5rem;
			}
			.unavailable {
				margin: 0;
			}
		`
	],
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

	private readonly recorder = new ShortcutRecorder(2, SHORTCUT_SEQUENCE_TIMEOUT_MS);
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
		const command = this.registry.commands.find((item) => item.id === commandId);
		if (!command) return;
		this.candidate.set({
			commandId,
			binding,
			refusal: refusalOf(command, binding),
			conflicts: conflictsOf(commandId, binding, this.registry.commands, this.registry.bindings())
		});
	}

	protected conflictNames(commands: ShortcutCommand[]): string {
		return commands.map((command) => this.translate.instant(commandKey(command.id))).join(', ');
	}

	protected async saveCandidate(): Promise<void> {
		const candidate = this.candidate();
		if (!candidate || candidate.refusal || candidate.conflicts.length) return;
		await this.save(candidate.commandId, candidate.binding);
		this.candidate.set(null);
	}

	protected async save(commandId: string, binding: ShortcutBinding | null | 'default'): Promise<void> {
		this.saving.set(true);
		try {
			await this.registry.saveBinding(commandId, binding);
			this.toastr.success('TASK_VIEWS.SHORTCUTS.SAVED');
		} catch {
			this.toastr.danger('TASK_VIEWS.SHORTCUTS.FAILED');
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
