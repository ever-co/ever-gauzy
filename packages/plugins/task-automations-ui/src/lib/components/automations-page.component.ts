import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, forkJoin, Subject, Subscription } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import {
	ID,
	IOrganization,
	ITaskAutomationRule,
	ITaskAutomationRun,
	ITaskAutomationTemplate,
	ITaskAutomationTestResult
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TaskAutomationsApiService } from '../services/task-automations-api.service';
import {
	ITaskAutomationChoice,
	ITaskAutomationDirectory,
	ITaskAutomationScope,
	mergeChoices,
	TaskAutomationsDirectoryService
} from '../services/task-automations-directory.service';
import { TASK_AUTOMATIONS_RUNS_SHOWN } from '../task-automations-ui.constants';
import {
	apiErrorMessage,
	blankDraft,
	changeValueText,
	draftOfRule,
	draftOfTemplate,
	droppedOrder,
	ITaskAutomationDraft,
	movedOrder,
	outcomeStatus,
	changedRuleInput,
	ruleInputOfDraft,
	rulesInOrder,
	TaskAutomationsView,
	templateDescriptionKey,
	templateNameKey,
	viewOfLoadError
} from '../task-automations-ui.helpers';
import { TaskAutomationEditorComponent } from './automation-editor.component';

const EMPTY_DIRECTORY: ITaskAutomationDirectory = { statuses: [], priorities: [], tags: [], employees: [], projects: [], teams: [] };

/**
 * Settings → Automations (`/pages/settings/automations`, spec `task-automations`; `TASK_AUTOMATION_MANAGE`): the
 * organization's automation rules in their order.
 *
 * - **List**: each rule with its trigger, scope and last run; switch it on or off; move it up or down (or drag it) —
 *   rules for the same change run in this order.
 * - **Create** blank or from a built-in template; **edit** the name, description, scope (a project, a team), trigger,
 *   conditions and actions ({@link TaskAutomationEditorComponent}); **delete** with its runs, after a confirmation.
 * - **Test** a rule on a task: whether the trigger applies, each condition, each change it would make — nothing is
 *   written. **History**: the rule's last runs with their outcome.
 *
 * The page asks the API first: a 404 means task automations are off on this installation, and the page says so.
 */
@Component({
	selector: 'ngx-task-automations-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		FormsModule,
		NbAlertModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		TranslatePipe,
		TaskAutomationEditorComponent
	],
	templateUrl: './automations-page.component.html',
	styleUrl: './automations-page.component.scss'
})
export class TaskAutomationsPageComponent implements OnInit {
	private readonly api = inject(TaskAutomationsApiService);
	private readonly directoryApi = inject(TaskAutomationsDirectoryService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly standalone = { standalone: true };
	protected readonly outcomeStatus = outcomeStatus;
	protected readonly templateNameKey = templateNameKey;
	protected readonly templateDescriptionKey = templateDescriptionKey;

	readonly view = signal<TaskAutomationsView>('loading');
	readonly organizationId = signal<ID | null>(null);
	readonly rules = signal<ITaskAutomationRule[]>([]);
	readonly templates = signal<ITaskAutomationTemplate[]>([]);
	/** The organization's choices, and the statuses and priorities of the scope the editor is narrowed to. */
	readonly baseDirectory = signal<ITaskAutomationDirectory>(EMPTY_DIRECTORY);
	readonly scopedChoices = signal<Pick<ITaskAutomationDirectory, 'statuses' | 'priorities'>>({ statuses: [], priorities: [] });
	readonly directory = computed<ITaskAutomationDirectory>(() => {
		const base = this.baseDirectory();
		const scoped = this.scopedChoices();
		return { ...base, statuses: mergeChoices(base.statuses, scoped.statuses), priorities: mergeChoices(base.priorities, scoped.priorities) };
	});
	readonly templatesOpen = signal(false);
	/** The rule being edited (or the new one), as the editor holds it. */
	readonly editing = signal<ITaskAutomationDraft | null>(null);
	readonly saving = signal(false);
	/** Rules with a switch in flight. */
	readonly busy = signal<ReadonlySet<string>>(new Set());
	readonly reordering = signal(false);
	readonly dragFrom = signal<number | null>(null);
	readonly confirmDelete = signal<string | null>(null);
	readonly actionError = signal<string | null>(null);

	/** The rule whose test and history are open. */
	readonly selectedId = signal<ID | null>(null);
	readonly selectedRule = computed(() => this.rules().find((rule) => rule.id === this.selectedId()) ?? null);
	readonly tasks = signal<ITaskAutomationChoice[]>([]);
	readonly taskFilter = signal('');
	readonly filteredTasks = computed(() => {
		const text = this.taskFilter().trim().toLowerCase();
		const tasks = this.tasks();
		return text
			? tasks.filter((task) => task.label.toLowerCase().includes(text) || (task.detail ?? '').toLowerCase().includes(text))
			: tasks;
	});
	readonly testTaskId = signal<ID | null>(null);
	readonly testing = signal(false);
	readonly testResult = signal<ITaskAutomationTestResult | null>(null);
	readonly runs = signal<ITaskAutomationRun[]>([]);
	readonly runsState = signal<'loading' | 'ready' | 'error'>('ready');

	/** Names of what a rule's changes name (statuses, priorities, people, labels), for the test and the history. */
	private readonly names = computed(() => {
		const directory = this.directory();
		return new Map<string, string>(
			[...directory.statuses, ...directory.priorities, ...directory.employees, ...directory.tags, ...this.tasks()].map(
				(choice) => [choice.value, choice.label] as [string, string]
			)
		);
	});

	/** Loads the page again (another organization, a retry). */
	private readonly load$ = new Subject<void>();
	/** The pickers' requests of the current organization (an answer for the previous one is dropped). */
	private directorySubscription?: Subscription;
	private tasksSubscription?: Subscription;
	private scopedSubscription?: Subscription;
	/** The open rule's history and test requests (another rule's late answer is dropped). */
	private runsSubscription?: Subscription;
	private testSubscription?: Subscription;

	ngOnInit(): void {
		this.destroyRef.onDestroy(() => {
			this.directorySubscription?.unsubscribe();
			this.tasksSubscription?.unsubscribe();
			this.runsSubscription?.unsubscribe();
			this.testSubscription?.unsubscribe();
			this.scopedSubscription?.unsubscribe();
		});
		this.load$
			.pipe(
				switchMap(() => {
					// What was asked for the previous organization does not land in this one.
					this.cancelPending();
					this.view.set('loading');
					return forkJoin({ templates: this.api.templates(), rules: this.api.list(this.organizationId()) }).pipe(
						catchError((error: unknown) => {
							this.view.set(viewOfLoadError(error));
							return EMPTY;
						})
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ templates, rules }) => {
				this.templates.set(templates ?? []);
				this.rules.set(rules ?? []);
				this.editing.set(null);
				this.selectedId.set(null);
				this.confirmDelete.set(null);
				this.view.set('ready');
				this.loadDirectory();
			});

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization | null | undefined) => !!organization?.id),
				map((organization: IOrganization) => organization.id as ID),
				distinctUntilChanged(),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((organizationId) => {
				this.organizationId.set(organizationId);
				this.reload();
			});
	}

	reload(): void {
		this.load$.next();
	}

	/** The pickers' lists; each one the user may not read is empty, never an error of the page. */
	private loadDirectory(): void {
		const organizationId = this.organizationId();
		const tenantId = (this.store.user?.tenantId as ID) ?? null;
		this.directorySubscription?.unsubscribe();
		this.tasksSubscription?.unsubscribe();
		if (!organizationId || !tenantId) return;
		this.directorySubscription = forkJoin({
			statuses: this.directoryApi.statuses(organizationId, tenantId),
			priorities: this.directoryApi.priorities(organizationId, tenantId),
			tags: this.directoryApi.tags(organizationId, tenantId),
			employees: this.directoryApi.employees(organizationId, tenantId),
			projects: this.directoryApi.projects(organizationId, tenantId),
			teams: this.directoryApi.teams(organizationId, tenantId)
		})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((directory) => this.baseDirectory.set(directory));
		this.tasksSubscription = this.directoryApi
			.tasks(organizationId, tenantId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((tasks) => this.tasks.set(tasks));
	}

	/**
	 * Offers the statuses and priorities of the project or team the editor's rule is narrowed to, beside the
	 * organization's (the platform keeps a project's own statuses apart from the organization-wide ones).
	 */
	loadScopedChoices(scope: ITaskAutomationScope): void {
		this.scopedSubscription?.unsubscribe();
		const organizationId = this.organizationId();
		const tenantId = (this.store.user?.tenantId as ID) ?? null;
		if (!organizationId || !tenantId || (!scope.projectId && !scope.organizationTeamId)) {
			this.scopedChoices.set({ statuses: [], priorities: [] });
			return;
		}
		this.scopedSubscription = forkJoin({
			statuses: this.directoryApi.statuses(organizationId, tenantId, scope),
			priorities: this.directoryApi.priorities(organizationId, tenantId, scope)
		}).subscribe((choices) => {
			if (this.organizationId() === organizationId) this.scopedChoices.set(choices);
		});
	}

	/** Stops what was asked for the organization or rule shown before. */
	private cancelPending(): void {
		for (const subscription of [
			this.directorySubscription,
			this.tasksSubscription,
			this.runsSubscription,
			this.testSubscription,
			this.scopedSubscription
		]) {
			subscription?.unsubscribe();
		}
		// A request cancelled here never answers: what it was holding is let go.
		this.testing.set(false);
		this.scopedChoices.set({ statuses: [], priorities: [] });
		// The pickers' lists and the dry run's task are the organization's: none of them is offered in the next one.
		this.baseDirectory.set(EMPTY_DIRECTORY);
		this.tasks.set([]);
		this.testTaskId.set(null);
		this.testResult.set(null);
	}

	/** Whether an answer is still the current organization's (a save that outlived a switch is not shown in the next). */
	private stillIn(organizationId: ID | null): boolean {
		return this.organizationId() === organizationId;
	}

	/** A template's own name or description in the user's language, else the API's English. */
	translated(key: string, fallback: string): string {
		const text = this.translate.instant(key);
		return typeof text === 'string' && text && text !== key ? text : fallback;
	}

	startBlank(): void {
		this.templatesOpen.set(false);
		this.selectedId.set(null);
		this.editing.set(blankDraft());
	}

	startFromTemplate(template: ITaskAutomationTemplate): void {
		this.templatesOpen.set(false);
		this.selectedId.set(null);
		this.editing.set(draftOfTemplate(template, this.translated(templateNameKey(template), template.name)));
	}

	edit(rule: ITaskAutomationRule): void {
		this.templatesOpen.set(false);
		this.selectedId.set(null);
		this.editing.set(draftOfRule(rule));
	}

	closeEditor(): void {
		this.editing.set(null);
		this.loadScopedChoices({});
	}

	/** Creates or updates the rule the editor holds; a refusal of the API is shown as it answers. */
	save(draft: ITaskAutomationDraft): void {
		const organizationId = this.organizationId();
		// The draft the editor was opened with: an edit sends only what changed from it, so a field another manager
		// changed meanwhile (the switch, say) is not written back; and only this editor closes when the save lands.
		const opened = this.editing();
		const input = ruleInputOfDraft(draft);
		const sent = draft.id && opened?.id === draft.id ? changedRuleInput(ruleInputOfDraft(opened), input) : input;
		// The switch as the list shows it now: if it moves before the answer, a toggle made here moved it.
		const enabledBefore = this.rules().find((rule) => rule.id === draft.id)?.isEnabled;
		const request$ = draft.id
			? this.api.update(draft.id, sent, organizationId)
			: this.api.create({ ...input, ...(draft.templateKey ? { templateKey: draft.templateKey } : {}) }, organizationId);
		this.saving.set(true);
		this.actionError.set(null);
		request$.subscribe({
			next: (saved) => {
				this.saving.set(false);
				if (!this.stillIn(organizationId)) return;
				// The saved rule as the API answers it (another manager's switch included), but a toggle made here while the
				// save was under way keeps its result, and so does the rule's place (a reorder).
				this.rules.update((rules) =>
					rules.some((rule) => rule.id === saved.id)
						? rules.map((rule) =>
								rule.id === saved.id
									? {
											...saved,
											isEnabled: !('isEnabled' in sent) && rule.isEnabled !== enabledBefore ? rule.isEnabled : saved.isEnabled,
											position: rule.position
										}
									: rule
							)
						: [...rules, saved]
				);
				if (this.editing() === opened) this.editing.set(null);
				this.toastr.success('TASK_AUTOMATIONS.SAVED', { name: saved.name });
			},
			error: (error: unknown) => {
				this.saving.set(false);
				if (!this.stillIn(organizationId)) return;
				this.actionError.set(apiErrorMessage(error) ?? 'TASK_AUTOMATIONS.ERRORS.SAVE');
			}
		});
	}

	/** Switches a rule on or off; the switch goes back when the API refuses. */
	toggle(rule: ITaskAutomationRule, isEnabled: boolean): void {
		const ruleId = rule.id as ID;
		const organizationId = this.organizationId();
		this.setBusy(ruleId, true);
		this.rules.update((rules) => rules.map((one) => (one.id === ruleId ? { ...one, isEnabled } : one)));
		this.api.update(ruleId, { isEnabled }, organizationId).subscribe({
			next: (saved) => {
				this.setBusy(ruleId, false);
				if (!this.stillIn(organizationId)) return;
				// Only the switch: a save of the same rule that landed meanwhile keeps its other fields.
				this.rules.update((rules) => rules.map((one) => (one.id === ruleId ? { ...one, isEnabled: saved.isEnabled } : one)));
			},
			error: (error: unknown) => {
				this.setBusy(ruleId, false);
				if (!this.stillIn(organizationId)) return;
				this.rules.update((rules) => rules.map((one) => (one.id === ruleId ? { ...one, isEnabled: !isEnabled } : one)));
				this.actionError.set(apiErrorMessage(error) ?? 'TASK_AUTOMATIONS.ERRORS.SAVE');
			}
		});
	}

	move(index: number, delta: number): void {
		this.reorder(movedOrder(this.ruleIds(), index, delta));
	}

	drop(index: number): void {
		const from = this.dragFrom();
		this.dragFrom.set(null);
		// One order at a time, as the move buttons: a drop while an order is under way is not sent.
		if (from === null || this.reordering()) return;
		this.reorder(droppedOrder(this.ruleIds(), from, index));
	}

	/**
	 * Sends a new order; the list shows it at once, and takes the API's order (or goes back to the one before) when the
	 * answer comes. Only the order is applied, to the rules as they are then: a switch, a save, a delete or a new rule
	 * made while the order was under way keeps its result.
	 */
	private reorder(ids: ID[]): void {
		const current = this.ruleIds();
		if (this.reordering() || ids.every((id, index) => id === current[index])) return;
		const previousOrder = [...current];
		this.rules.update((rules) => rulesInOrder(rules, ids));
		const organizationId = this.organizationId();
		this.reordering.set(true);
		this.api.reorder(ids, organizationId).subscribe({
			next: (rules) => {
				this.reordering.set(false);
				if (!this.stillIn(organizationId)) return;
				const order = (rules ?? []).map((rule) => rule.id as ID);
				this.rules.update((now) => rulesInOrder(now, order));
			},
			error: (error: unknown) => {
				this.reordering.set(false);
				if (!this.stillIn(organizationId)) return;
				this.rules.update((now) => rulesInOrder(now, previousOrder));
				this.actionError.set(apiErrorMessage(error) ?? 'TASK_AUTOMATIONS.ERRORS.REORDER');
			}
		});
	}

	remove(rule: ITaskAutomationRule): void {
		const ruleId = rule.id as ID;
		const organizationId = this.organizationId();
		this.confirmDelete.set(null);
		this.api.remove(ruleId, organizationId).subscribe({
			next: () => {
				if (!this.stillIn(organizationId)) return;
				this.rules.update((rules) => rules.filter((one) => one.id !== ruleId));
				if (this.selectedId() === ruleId) this.selectedId.set(null);
				if (this.editing()?.id === ruleId) this.editing.set(null);
				this.toastr.success('TASK_AUTOMATIONS.DELETED', { name: rule.name });
			},
			error: (error: unknown) => {
				if (this.stillIn(organizationId)) this.actionError.set(apiErrorMessage(error) ?? 'TASK_AUTOMATIONS.ERRORS.DELETE');
			}
		});
	}

	/** Opens a rule's test and history (and reads the history). */
	open(rule: ITaskAutomationRule): void {
		this.editing.set(null);
		if (this.selectedId() !== rule.id) {
			// Another rule: a dry run still under way for the one before is dropped, and its Test button let go.
			this.testSubscription?.unsubscribe();
			this.testing.set(false);
		}
		this.selectedId.set(rule.id as ID);
		this.testResult.set(null);
		this.loadRuns(rule);
	}

	/** Picks the dry run's task: a dry run under way for another task is dropped, and the answer shown for it too. */
	pickTestTask(taskId: ID | null): void {
		if (taskId !== this.testTaskId()) {
			this.testSubscription?.unsubscribe();
			this.testing.set(false);
		}
		this.testTaskId.set(taskId);
		this.testResult.set(null);
	}

	loadRuns(rule: ITaskAutomationRule): void {
		const ruleId = rule.id as ID;
		this.runsSubscription?.unsubscribe();
		this.runsState.set('loading');
		this.runsSubscription = this.api.runs(ruleId, TASK_AUTOMATIONS_RUNS_SHOWN, this.organizationId()).subscribe({
			next: (runs) => {
				if (this.selectedId() !== ruleId) return;
				this.runs.set(runs ?? []);
				this.runsState.set('ready');
			},
			error: () => {
				if (this.selectedId() !== ruleId) return;
				this.runs.set([]);
				this.runsState.set('error');
			}
		});
	}

	runTest(rule: ITaskAutomationRule): void {
		const taskId = this.testTaskId();
		if (!taskId) return;
		const ruleId = rule.id as ID;
		this.testSubscription?.unsubscribe();
		this.testing.set(true);
		this.testResult.set(null);
		this.testSubscription = this.api.test(ruleId, taskId, this.organizationId()).subscribe({
			next: (result) => {
				this.testing.set(false);
				// An answer for a rule or a task no longer picked is not this one's.
				if (this.selectedId() === ruleId && this.testTaskId() === taskId) this.testResult.set(result);
			},
			error: (error: unknown) => {
				this.testing.set(false);
				if (this.selectedId() === ruleId && this.testTaskId() === taskId) {
					this.actionError.set(apiErrorMessage(error) ?? 'TASK_AUTOMATIONS.ERRORS.TEST');
				}
			}
		});
	}

	/** A project's or team's name, else its id. */
	nameOf(list: 'projects' | 'teams', id: string): string {
		return this.directory()[list].find((choice) => choice.value === id)?.label ?? id;
	}

	taskName(taskId: ID | null | undefined): string {
		if (!taskId) return '—';
		const task = this.tasks().find((choice) => choice.value === taskId);
		return task ? [task.detail, task.label].filter(Boolean).join(' ') : taskId;
	}

	valueText(value: unknown): string {
		return changeValueText(value, this.names());
	}

	/** What a run changed, or why not, on one line. */
	runDetails(run: ITaskAutomationRun): string {
		const details = run.details ?? {};
		const changes = (details.changes ?? []).filter((change) => change.to !== undefined && !change.note?.startsWith('Already'));
		const parts = changes.map((change) => `${change.field ?? change.action}: ${this.valueText(change.from)} → ${this.valueText(change.to)}`);
		const failed = (details.conditions ?? []).filter((condition) => !condition.passed).map((condition) => condition.type);
		if (failed.length) parts.push(failed.join(', '));
		if (details.note) parts.push(details.note);
		if (run.error) parts.push(run.error);
		return parts.join(' · ') || '—';
	}

	private ruleIds(): ID[] {
		return this.rules().map((rule) => rule.id as ID);
	}

	private setBusy(ruleId: ID, busy: boolean): void {
		this.busy.update((ids) => {
			const next = new Set(ids);
			if (busy) next.add(ruleId);
			else next.delete(ruleId);
			return next;
		});
	}
}
