import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule
} from '@nebular/theme';
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
 * (with the statuses a status change waits for, and whether a closed link waits for a merge), its conditions and its
 * actions, each with the picker its type needs.
 * It edits a copy of the draft it is given and hands the copy to `save`; the page sends it to the API.
 */
@Component({
	selector: 'ngx-task-automation-editor',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NbButtonModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbToggleModule,
		TranslatePipe
	],
	templateUrl: './automation-editor.component.html',
	styleUrl: './automation-editor.component.scss'
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
					trigger: {
						type: TaskAutomationTriggerEnum.STATUS_CHANGED,
						toStatuses: [],
						fromStatuses: [],
						mergedOnly: false
					},
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
