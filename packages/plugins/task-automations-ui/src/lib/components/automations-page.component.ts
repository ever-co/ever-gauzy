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
	template: `
		<nb-card class="page" data-test="automations-page">
			<nb-card-header>
				<h4>{{ 'TASK_AUTOMATIONS.TITLE' | translate }}</h4>
				<p class="subtitle">{{ 'TASK_AUTOMATIONS.SUBTITLE' | translate }}</p>
			</nb-card-header>
			<nb-card-body>
				@switch (view()) {
					@case ('loading') {
						<div class="loading" data-test="loading" [nbSpinner]="true"></div>
					}
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'TASK_AUTOMATIONS.UNAVAILABLE' | translate }}</p>
					}
					@case ('forbidden') {
						<p data-test="forbidden">{{ 'TASK_AUTOMATIONS.FORBIDDEN' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ 'TASK_AUTOMATIONS.ERRORS.LOAD' | translate }}</nb-alert>
						<button nbButton size="small" type="button" data-test="retry" (click)="reload()">
							{{ 'TASK_AUTOMATIONS.RETRY' | translate }}
						</button>
					}
					@default {
						@if (actionError(); as message) {
							<nb-alert status="danger" role="alert" closable data-test="action-error" (close)="actionError.set(null)">{{
								message | translate
							}}</nb-alert>
						}

						<div class="toolbar">
							<button nbButton size="small" status="primary" type="button" data-test="new-blank" (click)="startBlank()">
								<nb-icon icon="plus-outline"></nb-icon>{{ 'TASK_AUTOMATIONS.NEW_BLANK' | translate }}
							</button>
							<button
								nbButton
								size="small"
								type="button"
								data-test="show-templates"
								[attr.aria-expanded]="templatesOpen()"
								(click)="templatesOpen.set(!templatesOpen())"
							>
								<nb-icon icon="layers-outline"></nb-icon>{{ 'TASK_AUTOMATIONS.FROM_TEMPLATE' | translate }}
							</button>
						</div>

						@if (templatesOpen()) {
							<section class="templates" data-test="templates">
								@for (template of templates(); track template.key) {
									<div class="template" [attr.data-test]="'template-' + template.key">
										<div class="template-text">
											<div class="template-name">{{ translated(templateNameKey(template), template.name) }}</div>
											<p class="hint">{{ translated(templateDescriptionKey(template), template.description) }}</p>
											@if (template.requiresIntegration) {
												<p class="hint warn">{{ 'TASK_AUTOMATIONS.REQUIRES_INTEGRATION' | translate }}</p>
											}
										</div>
										<button
											nbButton
											size="small"
											type="button"
											[attr.data-test]="'use-' + template.key"
											(click)="startFromTemplate(template)"
										>
											{{ 'TASK_AUTOMATIONS.USE_TEMPLATE' | translate }}
										</button>
									</div>
								}
							</section>
						}

						@if (editing(); as draft) {
							<section class="panel" data-test="editing">
								<h5>{{ (draft.id ? 'TASK_AUTOMATIONS.EDIT_TITLE' : 'TASK_AUTOMATIONS.NEW_TITLE') | translate }}</h5>
								<ngx-task-automation-editor
									[value]="draft"
									[directory]="directory()"
									[saving]="saving()"
									(save)="save($event)"
									(cancel)="closeEditor()"
									(scopeChange)="loadScopedChoices($event)"
								></ngx-task-automation-editor>
							</section>
						}

						@if (!rules().length) {
							<p class="empty" data-test="empty">{{ 'TASK_AUTOMATIONS.EMPTY' | translate }}</p>
						} @else {
							<ol class="rules" data-test="rules" [attr.aria-label]="'TASK_AUTOMATIONS.LIST' | translate">
								@for (rule of rules(); track rule.id; let index = $index, first = $first, last = $last) {
									<li
										class="rule"
										draggable="true"
										[class.selected]="rule.id === selectedId()"
										[class.dragging]="dragFrom() === index"
										[attr.data-test]="'rule-' + rule.id"
										(dragstart)="dragFrom.set(index)"
										(dragend)="dragFrom.set(null)"
										(dragover)="$event.preventDefault()"
										(drop)="$event.preventDefault(); drop(index)"
									>
										<div class="rule-main">
											<nb-toggle
												[attr.data-test]="'toggle-' + rule.id"
												[attr.aria-label]="'TASK_AUTOMATIONS.ENABLED' | translate"
												[checked]="rule.isEnabled"
												[disabled]="busy().has(rule.id)"
												(checkedChange)="toggle(rule, $event)"
											></nb-toggle>
											<div class="rule-text">
												<div class="rule-name">{{ rule.name }}</div>
												<div class="hint">
													{{ 'TASK_AUTOMATIONS.TRIGGERS.' + rule.trigger.type | translate }}
													@if (rule.projectId) {
														· {{ nameOf('projects', rule.projectId) }}
													}
													@if (rule.organizationTeamId) {
														· {{ nameOf('teams', rule.organizationTeamId) }}
													}
													@if (rule.lastRunAt) {
														· {{ 'TASK_AUTOMATIONS.LAST_RUN' | translate }} {{ rule.lastRunAt | date: 'short' }}
													}
												</div>
											</div>
										</div>
										<div class="rule-actions">
											<button
												nbButton
												ghost
												size="tiny"
												type="button"
												[attr.aria-label]="'TASK_AUTOMATIONS.MOVE_UP' | translate"
												[attr.data-test]="'up-' + rule.id"
												[disabled]="first || reordering()"
												(click)="move(index, -1)"
											>
												<nb-icon icon="arrow-upward-outline"></nb-icon>
											</button>
											<button
												nbButton
												ghost
												size="tiny"
												type="button"
												[attr.aria-label]="'TASK_AUTOMATIONS.MOVE_DOWN' | translate"
												[attr.data-test]="'down-' + rule.id"
												[disabled]="last || reordering()"
												(click)="move(index, 1)"
											>
												<nb-icon icon="arrow-downward-outline"></nb-icon>
											</button>
											<button nbButton ghost size="tiny" type="button" [attr.data-test]="'edit-' + rule.id" (click)="edit(rule)">
												{{ 'TASK_AUTOMATIONS.EDIT' | translate }}
											</button>
											<button nbButton ghost size="tiny" type="button" [attr.data-test]="'open-' + rule.id" (click)="open(rule)">
												{{ 'TASK_AUTOMATIONS.TEST_AND_HISTORY' | translate }}
											</button>
											@if (confirmDelete() === rule.id) {
												<button
													nbButton
													size="tiny"
													status="danger"
													type="button"
													[attr.data-test]="'confirm-delete-' + rule.id"
													(click)="remove(rule)"
												>
													{{ 'TASK_AUTOMATIONS.CONFIRM_DELETE' | translate }}
												</button>
												<button nbButton ghost size="tiny" type="button" (click)="confirmDelete.set(null)">
													{{ 'TASK_AUTOMATIONS.FORM.CANCEL' | translate }}
												</button>
											} @else {
												<button
													nbButton
													ghost
													size="tiny"
													status="danger"
													type="button"
													[attr.data-test]="'delete-' + rule.id"
													(click)="confirmDelete.set(rule.id)"
												>
													{{ 'TASK_AUTOMATIONS.DELETE' | translate }}
												</button>
											}
										</div>
									</li>
								}
							</ol>
						}

						@if (selectedRule(); as rule) {
							<section class="panel" data-test="details">
								<h5>{{ rule.name }}</h5>
								<h6>{{ 'TASK_AUTOMATIONS.TEST.TITLE' | translate }}</h6>
								<p class="hint">{{ 'TASK_AUTOMATIONS.TEST.HINT' | translate }}</p>
								<div class="line">
									<input
										nbInput
										fieldSize="small"
										data-test="task-filter"
										[attr.aria-label]="'TASK_AUTOMATIONS.TEST.FILTER' | translate"
										[placeholder]="'TASK_AUTOMATIONS.TEST.FILTER' | translate"
										[ngModel]="taskFilter()"
										[ngModelOptions]="standalone"
										(ngModelChange)="taskFilter.set($event)"
									/>
									<nb-select
										size="small"
										class="task"
										data-test="test-task"
										[placeholder]="'TASK_AUTOMATIONS.TEST.CHOOSE_TASK' | translate"
										[selected]="testTaskId()"
										(selectedChange)="testTaskId.set($event)"
									>
										@for (task of filteredTasks(); track task.value) {
											<nb-option [value]="task.value"
												>@if (task.detail) {
													<span class="detail">{{ task.detail }}</span>
												}
												{{ task.label }}</nb-option
											>
										}
									</nb-select>
									<button
										nbButton
										size="small"
										status="primary"
										type="button"
										data-test="run-test"
										[disabled]="!testTaskId() || testing()"
										(click)="runTest(rule)"
									>
										{{ 'TASK_AUTOMATIONS.TEST.RUN' | translate }}
									</button>
								</div>
								@if (testResult(); as result) {
									<div class="result" data-test="test-result">
										<p>
											<strong>{{ 'TASK_AUTOMATIONS.TEST.TRIGGER' | translate }}</strong>
											<nb-badge
												[status]="result.triggerMatches === false ? 'warning' : result.triggerMatches ? 'success' : 'basic'"
												[text]="
													(result.triggerMatches === null
														? 'TASK_AUTOMATIONS.TEST.ON_EVENT'
														: result.triggerMatches
															? 'TASK_AUTOMATIONS.TEST.APPLIES'
															: 'TASK_AUTOMATIONS.TEST.DOES_NOT_APPLY'
													) | translate
												"
												position="center right"
											></nb-badge>
										</p>
										@if (result.triggerNote) {
											<p class="hint">{{ result.triggerNote }}</p>
										}
										@if (result.conditions.length) {
											<p><strong>{{ 'TASK_AUTOMATIONS.TEST.CONDITIONS' | translate }}</strong></p>
											<ul data-test="test-conditions">
												@for (condition of result.conditions; track $index) {
													<li [class.failed]="!condition.passed">
														{{ (condition.passed ? '✓ ' : '✗ ') }}{{ 'TASK_AUTOMATIONS.CONDITIONS.' + condition.type | translate }}
														@if (condition.detail) {
															<span class="hint">({{ condition.detail }})</span>
														}
													</li>
												}
											</ul>
										}
										<p><strong>{{ 'TASK_AUTOMATIONS.TEST.CHANGES' | translate }}</strong></p>
										<ul data-test="test-changes">
											@for (change of result.changes; track $index) {
												<li [class.failed]="change.failed">
													{{ 'TASK_AUTOMATIONS.ACTIONS.' + change.action | translate }}:
													{{ valueText(change.from) }} → {{ valueText(change.to) }}
													@if (change.note) {
														<span class="hint">({{ change.note }})</span>
													}
												</li>
											}
										</ul>
										<p>
											<strong>{{ 'TASK_AUTOMATIONS.TEST.OUTCOME' | translate }}</strong>
											<span [class]="'outcome ' + outcomeStatus(result.outcome)" data-test="test-outcome">{{
												'TASK_AUTOMATIONS.OUTCOMES.' + result.outcome | translate
											}}</span>
										</p>
									</div>
								}

								<h6>{{ 'TASK_AUTOMATIONS.HISTORY.TITLE' | translate }}</h6>
								@switch (runsState()) {
									@case ('loading') {
										<div class="loading small" [nbSpinner]="true"></div>
									}
									@case ('error') {
										<p class="hint warn" data-test="runs-error">{{ 'TASK_AUTOMATIONS.HISTORY.ERROR' | translate }}</p>
									}
									@default {
										@if (!runs().length) {
											<p class="hint" data-test="no-runs">{{ 'TASK_AUTOMATIONS.HISTORY.EMPTY' | translate }}</p>
										} @else {
											<table class="runs" data-test="runs">
												<thead>
													<tr>
														<th>{{ 'TASK_AUTOMATIONS.HISTORY.WHEN' | translate }}</th>
														<th>{{ 'TASK_AUTOMATIONS.HISTORY.TASK' | translate }}</th>
														<th>{{ 'TASK_AUTOMATIONS.HISTORY.OUTCOME' | translate }}</th>
														<th>{{ 'TASK_AUTOMATIONS.HISTORY.DETAILS' | translate }}</th>
													</tr>
												</thead>
												<tbody>
													@for (run of runs(); track run.id) {
														<tr [attr.data-test]="'run-' + run.id">
															<td>{{ run.createdAt | date: 'short' }}</td>
															<td>{{ taskName(run.taskId) }}</td>
															<td>
																<span [class]="'outcome ' + outcomeStatus(run.outcome)">{{
																	'TASK_AUTOMATIONS.OUTCOMES.' + run.outcome | translate
																}}</span>
															</td>
															<td>{{ runDetails(run) }}</td>
														</tr>
													}
												</tbody>
											</table>
										}
									}
								}
								<button nbButton ghost size="small" type="button" data-test="close-details" (click)="selectedId.set(null)">
									{{ 'TASK_AUTOMATIONS.CLOSE' | translate }}
								</button>
							</section>
						}
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.subtitle,
			.hint {
				font-size: 0.85rem;
				opacity: 0.75;
				margin: 0.25rem 0 0;
			}
			.warn {
				color: var(--color-warning-default, #b80);
				opacity: 1;
			}
			.loading {
				min-height: 6rem;
			}
			.loading.small {
				min-height: 3rem;
			}
			.toolbar {
				display: flex;
				gap: 0.5rem;
				margin-bottom: 1rem;
			}
			.templates,
			.panel {
				border: 1px solid var(--border-basic-color-3, #e4e9f2);
				border-radius: 0.5rem;
				padding: 1rem;
				margin-bottom: 1rem;
			}
			.template {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 1rem;
				padding: 0.5rem 0;
			}
			.template + .template {
				border-top: 1px solid var(--border-basic-color-3, #e4e9f2);
			}
			.template-name,
			.rule-name {
				font-weight: 600;
			}
			.rules {
				list-style: none;
				padding: 0;
				margin: 0 0 1rem;
			}
			.rule {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 1rem;
				padding: 0.75rem;
				border: 1px solid var(--border-basic-color-3, #e4e9f2);
				border-radius: 0.5rem;
				margin-bottom: 0.5rem;
				cursor: grab;
			}
			.rule.selected {
				border-color: var(--color-primary-default, #36f);
			}
			.rule.dragging {
				opacity: 0.5;
			}
			.rule-main {
				display: flex;
				align-items: center;
				gap: 0.75rem;
			}
			.rule-actions {
				display: flex;
				gap: 0.25rem;
				flex-wrap: wrap;
			}
			.line {
				display: flex;
				gap: 0.5rem;
				align-items: center;
				flex-wrap: wrap;
				margin-bottom: 0.75rem;
			}
			.task {
				min-width: 18rem;
			}
			.detail {
				opacity: 0.7;
				margin-right: 0.25rem;
			}
			.failed {
				color: var(--color-danger-default, #d33);
			}
			.outcome.success {
				color: var(--color-success-default, #0a0);
			}
			.outcome.warning {
				color: var(--color-warning-default, #b80);
			}
			.outcome.danger {
				color: var(--color-danger-default, #d33);
			}
			.runs {
				width: 100%;
				border-collapse: collapse;
				font-size: 0.85rem;
				margin-bottom: 0.75rem;
			}
			.runs th,
			.runs td {
				text-align: left;
				padding: 0.25rem 0.5rem;
				border-bottom: 1px solid var(--border-basic-color-3, #e4e9f2);
			}
		`
	]
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
		const input = ruleInputOfDraft(draft);
		const request$ = draft.id
			? this.api.update(draft.id, input, organizationId)
			: this.api.create({ ...input, ...(draft.templateKey ? { templateKey: draft.templateKey } : {}) }, organizationId);
		this.saving.set(true);
		this.actionError.set(null);
		request$.subscribe({
			next: (saved) => {
				this.saving.set(false);
				if (!this.stillIn(organizationId)) return;
				this.rules.update((rules) =>
					rules.some((rule) => rule.id === saved.id) ? rules.map((rule) => (rule.id === saved.id ? saved : rule)) : [...rules, saved]
				);
				this.editing.set(null);
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
				this.rules.update((rules) => rules.map((one) => (one.id === ruleId ? saved : one)));
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
		if (from === null) return;
		this.reorder(droppedOrder(this.ruleIds(), from, index));
	}

	/**
	 * Sends a new order; the list shows it at once, and takes the API's order (or goes back to the one before) when the
	 * answer comes. Only the order is applied, to the rules as they are then: a switch, a save, a delete or a new rule
	 * made while the order was under way keeps its result.
	 */
	private reorder(ids: ID[]): void {
		const current = this.ruleIds();
		if (ids.every((id, index) => id === current[index])) return;
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
		this.selectedId.set(rule.id as ID);
		this.testResult.set(null);
		this.loadRuns(rule);
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
				// An answer for a rule that is no longer open is not this one's.
				if (this.selectedId() === ruleId) this.testResult.set(result);
			},
			error: (error: unknown) => {
				this.testing.set(false);
				this.actionError.set(apiErrorMessage(error) ?? 'TASK_AUTOMATIONS.ERRORS.TEST');
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
