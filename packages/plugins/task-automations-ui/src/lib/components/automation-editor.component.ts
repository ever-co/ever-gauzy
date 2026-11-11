import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	TASK_AUTOMATION_LIMITS,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { ITaskAutomationChoice, ITaskAutomationDirectory } from '../services/task-automations-directory.service';
import {
	ACTION_TYPES,
	actionInput,
	CONDITION_TYPES,
	conditionInput,
	draftErrors,
	ITaskAutomationActionDraft,
	ITaskAutomationConditionDraft,
	ITaskAutomationDraft,
	newAction,
	newCondition,
	STATUS_CATEGORIES,
	TRIGGER_TYPES
} from '../task-automations-ui.helpers';

const EMPTY_DIRECTORY: ITaskAutomationDirectory = { statuses: [], priorities: [], tags: [], employees: [], projects: [], teams: [] };

/**
 * Adds to a picker's choices the values a rule names that the lists do not hold (a label the user may not read, a
 * status of a project of another team), so a saved rule shows and keeps them.
 */
export function withNamed(choices: readonly ITaskAutomationChoice[], named: readonly string[]): ITaskAutomationChoice[] {
	const known = new Set(choices.map((choice) => choice.value));
	return [...choices, ...named.filter((value) => !!value && !known.has(value)).map((value) => ({ value, label: value }))];
}

/**
 * The editor of one automation rule: its name, description, scope (a project, a team), whether it is on, its trigger
 * (with the statuses a status change waits for), its conditions and its actions, each with the picker its type needs.
 * It edits a copy of the draft it is given and hands the copy to `save`; the page sends it to the API.
 */
@Component({
	selector: 'ngx-task-automation-editor',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbIconModule, NbInputModule, NbSelectModule, NbToggleModule, TranslatePipe],
	template: `
		<form class="editor" data-test="editor" (submit)="$event.preventDefault(); submit()">
			<div class="field">
				<label class="label" for="task-automation-name"
					>{{ 'TASK_AUTOMATIONS.FORM.NAME' | translate }} <span class="required" aria-hidden="true">*</span></label
				>
				<input
					nbInput
					fullWidth
					fieldSize="small"
					id="task-automation-name"
					data-test="name"
					[attr.maxlength]="limits.nameLength"
					[ngModel]="draft().name"
					[ngModelOptions]="standalone"
					(ngModelChange)="patch({ name: $event })"
				/>
			</div>
			<div class="field">
				<label class="label" for="task-automation-description">{{ 'TASK_AUTOMATIONS.FORM.DESCRIPTION' | translate }}</label>
				<textarea
					nbInput
					fullWidth
					rows="2"
					id="task-automation-description"
					data-test="description"
					[attr.maxlength]="limits.descriptionLength"
					[ngModel]="draft().description"
					[ngModelOptions]="standalone"
					(ngModelChange)="patch({ description: $event })"
				></textarea>
			</div>
			<div class="row">
				<div class="field">
					<label class="label" for="task-automation-project">{{ 'TASK_AUTOMATIONS.FORM.PROJECT' | translate }}</label>
					<nb-select
						fullWidth
						size="small"
						id="task-automation-project"
						data-test="project"
						[selected]="draft().projectId"
						(selectedChange)="patchScope({ projectId: $event })"
					>
						<nb-option [value]="null">{{ 'TASK_AUTOMATIONS.FORM.ANY_PROJECT' | translate }}</nb-option>
						@for (choice of projects(); track choice.value) {
							<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
						}
					</nb-select>
				</div>
				<div class="field">
					<label class="label" for="task-automation-team">{{ 'TASK_AUTOMATIONS.FORM.TEAM' | translate }}</label>
					<nb-select
						fullWidth
						size="small"
						id="task-automation-team"
						data-test="team"
						[selected]="draft().organizationTeamId"
						(selectedChange)="patchScope({ organizationTeamId: $event })"
					>
						<nb-option [value]="null">{{ 'TASK_AUTOMATIONS.FORM.ANY_TEAM' | translate }}</nb-option>
						@for (choice of teams(); track choice.value) {
							<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
						}
					</nb-select>
				</div>
			</div>
			<div class="field">
				<nb-toggle data-test="enabled" [checked]="draft().isEnabled" (checkedChange)="patch({ isEnabled: $event })">
					{{ 'TASK_AUTOMATIONS.FORM.ENABLED' | translate }}
				</nb-toggle>
			</div>

			<h6 class="section">{{ 'TASK_AUTOMATIONS.FORM.WHEN' | translate }}</h6>
			<div class="field">
				<label class="label" for="task-automation-trigger">{{ 'TASK_AUTOMATIONS.FORM.TRIGGER' | translate }}</label>
				<nb-select
					fullWidth
					size="small"
					id="task-automation-trigger"
					data-test="trigger"
					[selected]="draft().trigger.type"
					(selectedChange)="setTrigger($event)"
				>
					@for (type of triggerTypes; track type) {
						<nb-option [value]="type">{{ 'TASK_AUTOMATIONS.TRIGGERS.' + type | translate }}</nb-option>
					}
				</nb-select>
				<p class="hint">{{ 'TASK_AUTOMATIONS.TRIGGER_HINTS.' + draft().trigger.type | translate }}</p>
			</div>
			@if (draft().trigger.type === triggers.STATUS_CHANGED) {
				<div class="row">
					<div class="field">
						<label class="label" for="task-automation-to">{{ 'TASK_AUTOMATIONS.FORM.TO_STATUSES' | translate }}</label>
						<nb-select
							fullWidth
							multiple
							size="small"
							id="task-automation-to"
							data-test="to-statuses"
							[placeholder]="'TASK_AUTOMATIONS.FORM.ANY_STATUS' | translate"
							[selected]="draft().trigger.toStatuses"
							(selectedChange)="patchTrigger({ toStatuses: $event })"
						>
							@for (choice of statusesWith(draft().trigger.toStatuses); track choice.value) {
								<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
							}
						</nb-select>
					</div>
					<div class="field">
						<label class="label" for="task-automation-from">{{ 'TASK_AUTOMATIONS.FORM.FROM_STATUSES' | translate }}</label>
						<nb-select
							fullWidth
							multiple
							size="small"
							id="task-automation-from"
							data-test="from-statuses"
							[placeholder]="'TASK_AUTOMATIONS.FORM.ANY_STATUS' | translate"
							[selected]="draft().trigger.fromStatuses"
							(selectedChange)="patchTrigger({ fromStatuses: $event })"
						>
							@for (choice of statusesWith(draft().trigger.fromStatuses); track choice.value) {
								<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
							}
						</nb-select>
					</div>
				</div>
			}

			<h6 class="section">{{ 'TASK_AUTOMATIONS.FORM.IF' | translate }}</h6>
			@if (!draft().conditions.length) {
				<p class="hint" data-test="no-conditions">{{ 'TASK_AUTOMATIONS.FORM.NO_CONDITIONS' | translate }}</p>
			}
			@for (condition of draft().conditions; track $index; let index = $index) {
				<div class="line" [attr.data-test]="'condition-' + index">
					<nb-select
						size="small"
						class="type"
						[attr.aria-label]="'TASK_AUTOMATIONS.FORM.CONDITION' | translate"
						[selected]="condition.type"
						(selectedChange)="setConditionType(index, $event)"
					>
						@for (type of conditionTypes; track type) {
							<nb-option [value]="type">{{ 'TASK_AUTOMATIONS.CONDITIONS.' + type | translate }}</nb-option>
						}
					</nb-select>
					@switch (conditionInputOf(condition.type)) {
						@case ('text') {
							<input
								nbInput
								fieldSize="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.TEXT' | translate"
								[attr.data-test]="'condition-text-' + index"
								[ngModel]="condition.text"
								[ngModelOptions]="standalone"
								(ngModelChange)="patchCondition(index, { text: $event })"
							/>
						}
						@case (null) {}
						@default {
							<nb-select
								multiple
								size="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.VALUES' | translate"
								[attr.data-test]="'condition-values-' + index"
								[placeholder]="'TASK_AUTOMATIONS.FORM.CHOOSE' | translate"
								[selected]="condition.values"
								(selectedChange)="patchCondition(index, { values: $event })"
							>
								@for (choice of conditionChoices(condition); track choice.value) {
									<nb-option [value]="choice.value">{{ choice.translate ? (choice.label | translate) : choice.label }}</nb-option>
								}
							</nb-select>
						}
					}
					<button
						nbButton
						ghost
						size="small"
						type="button"
						[attr.aria-label]="'TASK_AUTOMATIONS.FORM.REMOVE' | translate"
						[attr.data-test]="'remove-condition-' + index"
						(click)="removeCondition(index)"
					>
						<nb-icon icon="trash-2-outline"></nb-icon>
					</button>
				</div>
			}
			@if (draft().conditions.length < limits.conditionsPerRule) {
				<button nbButton ghost size="small" type="button" data-test="add-condition" (click)="addCondition()">
					<nb-icon icon="plus-outline"></nb-icon>{{ 'TASK_AUTOMATIONS.FORM.ADD_CONDITION' | translate }}
				</button>
			}

			<h6 class="section">{{ 'TASK_AUTOMATIONS.FORM.THEN' | translate }}</h6>
			@for (action of draft().actions; track $index; let index = $index) {
				<div class="line" [attr.data-test]="'action-' + index">
					<nb-select
						size="small"
						class="type"
						[attr.aria-label]="'TASK_AUTOMATIONS.FORM.ACTION' | translate"
						[selected]="action.type"
						(selectedChange)="setActionType(index, $event)"
					>
						@for (type of actionTypes; track type) {
							<nb-option [value]="type">{{ 'TASK_AUTOMATIONS.ACTIONS.' + type | translate }}</nb-option>
						}
					</nb-select>
					@switch (actionInputOf(action.type)) {
						@case ('status') {
							<nb-select
								size="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.STATUS' | translate"
								[attr.data-test]="'action-status-' + index"
								[selected]="statusChoiceOf(action)"
								(selectedChange)="setActionStatus(index, $event)"
							>
								@for (category of categories; track category) {
									<nb-option [value]="'category:' + category">{{
										'TASK_AUTOMATIONS.CATEGORIES.' + category | translate
									}}</nb-option>
								}
								@for (choice of statusesWith(action.status ? [action.status] : []); track choice.value) {
									<nb-option [value]="'status:' + choice.value">{{ choice.label }}</nb-option>
								}
							</nb-select>
						}
						@case ('priority') {
							<nb-select
								size="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.PRIORITY' | translate"
								[attr.data-test]="'action-priority-' + index"
								[placeholder]="'TASK_AUTOMATIONS.FORM.CHOOSE' | translate"
								[selected]="action.priority"
								(selectedChange)="patchAction(index, { priority: $event })"
							>
								@for (choice of prioritiesWith(action.priority ? [action.priority] : []); track choice.value) {
									<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
								}
							</nb-select>
						}
						@case ('employees') {
							<nb-select
								multiple
								size="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.PEOPLE' | translate"
								[attr.data-test]="'action-employees-' + index"
								[placeholder]="'TASK_AUTOMATIONS.FORM.CHOOSE' | translate"
								[selected]="action.employeeIds"
								(selectedChange)="patchAction(index, { employeeIds: $event })"
							>
								@for (choice of employeesWith(action.employeeIds); track choice.value) {
									<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
								}
							</nb-select>
						}
						@case ('tags') {
							<nb-select
								multiple
								size="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.LABELS' | translate"
								[attr.data-test]="'action-tags-' + index"
								[placeholder]="'TASK_AUTOMATIONS.FORM.CHOOSE' | translate"
								[selected]="action.tagIds"
								(selectedChange)="patchAction(index, { tagIds: $event })"
							>
								@for (choice of tagsWith(action.tagIds); track choice.value) {
									<nb-option [value]="choice.value">{{ choice.label }}</nb-option>
								}
							</nb-select>
						}
						@default {
							<input
								nbInput
								fieldSize="small"
								class="value"
								[attr.aria-label]="'TASK_AUTOMATIONS.FORM.MESSAGE' | translate"
								[attr.data-test]="'action-message-' + index"
								[attr.maxlength]="limits.messageLength"
								[placeholder]="'TASK_AUTOMATIONS.FORM.MESSAGE_PLACEHOLDER' | translate"
								[ngModel]="action.message"
								[ngModelOptions]="standalone"
								(ngModelChange)="patchAction(index, { message: $event })"
							/>
						}
					}
					<button
						nbButton
						ghost
						size="small"
						type="button"
						[attr.aria-label]="'TASK_AUTOMATIONS.FORM.REMOVE' | translate"
						[attr.data-test]="'remove-action-' + index"
						[disabled]="draft().actions.length === 1"
						(click)="removeAction(index)"
					>
						<nb-icon icon="trash-2-outline"></nb-icon>
					</button>
				</div>
			}
			@if (draft().actions.length < limits.actionsPerRule) {
				<button nbButton ghost size="small" type="button" data-test="add-action" (click)="addAction()">
					<nb-icon icon="plus-outline"></nb-icon>{{ 'TASK_AUTOMATIONS.FORM.ADD_ACTION' | translate }}
				</button>
			}

			@if (shownErrors().length) {
				<ul class="errors" role="alert" data-test="form-errors">
					@for (error of shownErrors(); track error) {
						<li>{{ error | translate }}</li>
					}
				</ul>
			}
			<div class="buttons">
				<button nbButton size="small" status="primary" type="submit" data-test="save" [disabled]="saving()">
					{{ 'TASK_AUTOMATIONS.FORM.SAVE' | translate }}
				</button>
				<button nbButton size="small" ghost type="button" data-test="cancel" (click)="cancel.emit()">
					{{ 'TASK_AUTOMATIONS.FORM.CANCEL' | translate }}
				</button>
			</div>
		</form>
	`,
	styles: [
		`
			.field {
				margin-bottom: 0.75rem;
				flex: 1;
			}
			.label {
				display: block;
				font-size: 0.8rem;
				margin-bottom: 0.25rem;
			}
			.required {
				color: var(--color-danger-default, #d33);
			}
			.row {
				display: flex;
				gap: 0.75rem;
				flex-wrap: wrap;
			}
			.section {
				margin: 1rem 0 0.5rem;
			}
			.line {
				display: flex;
				gap: 0.5rem;
				align-items: center;
				margin-bottom: 0.5rem;
				flex-wrap: wrap;
			}
			.type {
				min-width: 14rem;
			}
			.value {
				flex: 1;
				min-width: 12rem;
			}
			.hint {
				font-size: 0.8rem;
				opacity: 0.75;
				margin: 0.25rem 0 0;
			}
			.errors {
				color: var(--color-danger-default, #d33);
				font-size: 0.85rem;
				padding-left: 1rem;
			}
			.buttons {
				display: flex;
				gap: 0.5rem;
				margin-top: 1rem;
			}
		`
	]
})
export class TaskAutomationEditorComponent {
	/** The rule to edit; the editor works on a copy. */
	readonly value = input.required<ITaskAutomationDraft>();
	/** What the pickers offer. */
	readonly directory = input<ITaskAutomationDirectory>(EMPTY_DIRECTORY);
	/** Whether the page is saving (the button waits). */
	readonly saving = input(false);
	readonly save = output<ITaskAutomationDraft>();
	readonly cancel = output<void>();
	/** The project and team the draft is narrowed to, when they change (and once for the draft given). */
	readonly scopeChange = output<{ projectId: string | null; organizationTeamId: string | null }>();

	protected readonly limits = TASK_AUTOMATION_LIMITS;
	protected readonly standalone = { standalone: true };
	protected readonly triggers = TaskAutomationTriggerEnum;
	protected readonly triggerTypes = TRIGGER_TYPES;
	protected readonly conditionTypes = CONDITION_TYPES;
	protected readonly actionTypes = ACTION_TYPES;
	protected readonly categories = STATUS_CATEGORIES;

	readonly draft = signal<ITaskAutomationDraft>(this.copy(null));
	/** The errors are shown once a save was tried. */
	readonly tried = signal(false);
	readonly errors = computed(() => draftErrors(this.draft()));
	readonly shownErrors = computed(() => (this.tried() ? this.errors() : []));

	protected readonly projects = computed(() => withNamed(this.directory().projects, [this.draft().projectId ?? ''].filter(Boolean)));
	protected readonly teams = computed(() => withNamed(this.directory().teams, [this.draft().organizationTeamId ?? ''].filter(Boolean)));

	constructor() {
		// A new rule to edit (another row, a saved copy) starts the form over.
		effect(() => {
			const draft = this.copy(this.value());
			this.draft.set(draft);
			this.tried.set(false);
			this.scopeChange.emit({ projectId: draft.projectId, organizationTeamId: draft.organizationTeamId });
		});
	}

	private copy(draft: ITaskAutomationDraft | null): ITaskAutomationDraft {
		return draft
			? (JSON.parse(JSON.stringify(draft)) as ITaskAutomationDraft)
			: {
					id: null,
					templateKey: null,
					name: '',
					description: '',
					projectId: null,
					organizationTeamId: null,
					isEnabled: true,
					trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: [], fromStatuses: [] },
					conditions: [],
					actions: [newAction()]
				};
	}

	patch(change: Partial<ITaskAutomationDraft>): void {
		this.draft.update((draft) => ({ ...draft, ...change }));
	}

	/** Narrows the rule to a project or a team (the page then offers its own statuses and priorities too). */
	patchScope(change: Pick<Partial<ITaskAutomationDraft>, 'projectId' | 'organizationTeamId'>): void {
		this.patch(change);
		const draft = this.draft();
		this.scopeChange.emit({ projectId: draft.projectId, organizationTeamId: draft.organizationTeamId });
	}

	setTrigger(type: TaskAutomationTriggerEnum): void {
		this.draft.update((draft) => ({ ...draft, trigger: { ...draft.trigger, type } }));
	}

	patchTrigger(change: Partial<ITaskAutomationDraft['trigger']>): void {
		this.draft.update((draft) => ({ ...draft, trigger: { ...draft.trigger, ...change } }));
	}

	addCondition(): void {
		this.draft.update((draft) => ({ ...draft, conditions: [...draft.conditions, newCondition()] }));
	}

	removeCondition(index: number): void {
		this.draft.update((draft) => ({ ...draft, conditions: draft.conditions.filter((_, at) => at !== index) }));
	}

	/** Another type starts the condition over: a value of one type means nothing to another. */
	setConditionType(index: number, type: TaskAutomationConditionEnum): void {
		this.patchCondition(index, newCondition(type));
	}

	patchCondition(index: number, change: Partial<ITaskAutomationConditionDraft>): void {
		this.draft.update((draft) => ({
			...draft,
			conditions: draft.conditions.map((condition, at) => (at === index ? { ...condition, ...change } : condition))
		}));
	}

	addAction(): void {
		this.draft.update((draft) => ({ ...draft, actions: [...draft.actions, newAction(TaskAutomationActionEnum.NOTIFY_ASSIGNEES)] }));
	}

	removeAction(index: number): void {
		this.draft.update((draft) =>
			draft.actions.length > 1 ? { ...draft, actions: draft.actions.filter((_, at) => at !== index) } : draft
		);
	}

	setActionType(index: number, type: TaskAutomationActionEnum): void {
		this.patchAction(index, newAction(type));
	}

	patchAction(index: number, change: Partial<ITaskAutomationActionDraft>): void {
		this.draft.update((draft) => ({
			...draft,
			actions: draft.actions.map((action, at) => (at === index ? { ...action, ...change } : action))
		}));
	}

	/** The value of the status picker: `category:<category>` or `status:<value>`. */
	statusChoiceOf(action: ITaskAutomationActionDraft): string {
		return action.statusMode === 'status' && action.status ? `status:${action.status}` : `category:${action.category}`;
	}

	setActionStatus(index: number, choice: string): void {
		const [kind, ...rest] = String(choice ?? '').split(':');
		const value = rest.join(':');
		if (kind === 'status' && value) {
			this.patchAction(index, { statusMode: 'status', status: value });
		} else if (value) {
			this.patchAction(index, { statusMode: 'category', status: '', category: value as TaskAutomationStatusCategoryEnum });
		}
	}

	protected conditionInputOf = conditionInput;
	protected actionInputOf = actionInput;

	protected statusesWith(named: readonly string[]): ITaskAutomationChoice[] {
		return withNamed(this.directory().statuses, named);
	}

	protected prioritiesWith(named: readonly string[]): ITaskAutomationChoice[] {
		return withNamed(this.directory().priorities, named);
	}

	protected employeesWith(named: readonly string[]): ITaskAutomationChoice[] {
		return withNamed(this.directory().employees, named);
	}

	protected tagsWith(named: readonly string[]): ITaskAutomationChoice[] {
		return withNamed(this.directory().tags, named);
	}

	protected conditionChoices(condition: ITaskAutomationConditionDraft): ITaskAutomationChoice[] {
		switch (conditionInput(condition.type)) {
			case 'statuses':
				return this.statusesWith(condition.values);
			case 'categories':
				return STATUS_CATEGORIES.map((category) => ({ value: category, label: `TASK_AUTOMATIONS.CATEGORIES.${category}`, translate: true }));
			case 'priorities':
				return this.prioritiesWith(condition.values);
			case 'tags':
				return this.tagsWith(condition.values);
			case 'employees':
				return this.employeesWith(condition.values);
			default:
				return [];
		}
	}

	/** Hands the draft to the page, or shows what keeps it from being saved. */
	submit(): void {
		this.tried.set(true);
		if (this.errors().length) return;
		this.save.emit(this.copy(this.draft()));
	}
}
