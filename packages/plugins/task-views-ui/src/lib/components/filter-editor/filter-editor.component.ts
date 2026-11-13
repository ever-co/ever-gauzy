import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	ID,
	ITaskViewFilterCondition,
	ITaskViewFilterGroup,
	ITaskViewInvalidFilter,
	ITaskViewRelativeDate,
	TaskViewFilterField,
	TaskViewFilterOperator
} from '@gauzy/contracts';
import {
	addCondition,
	addGroup,
	canAdd,
	FILTER_FIELDS,
	FILTER_MAX_DEPTH,
	FilterPath,
	fieldKindOf,
	isFilterGroup,
	newCondition,
	operatorsOf,
	pathKey,
	removeNode,
	setGroupOp,
	updateNode,
	withField,
	withOperator,
	withPickedDay,
	withRelative,
	withValues,
	withoutInvalid
} from '../../models/filter-tree';
import { dayOfBound } from '../../models/date-input';
import {
	EMPTY_OPTIONS,
	optionsOfField,
	TaskViewOption,
	TaskViewOptions
} from '../../services/task-views-options.service';

/** The i18n key of a field, an operator, an invalid reason. */
export const fieldKey = (field: string) =>
	`TASK_VIEWS.FILTER.FIELDS.${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
export const operatorKey = (operator: string) =>
	`TASK_VIEWS.FILTER.OPERATORS.${operator.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
export const invalidKey = (reason: string) => `TASK_VIEWS.FILTER.INVALID.${reason.replace(/-/g, '_').toUpperCase()}`;

/**
 * The filter-tree editor of a view: conditions on the fields the platform filters on (status, priority, size,
 * labels, assignees, project, team, sprint, and the dates), joined by "all of" (and) or "any of" (or), with nested
 * groups. Each change answers the whole new tree (`treeChange`); the conditions the platform reported as invalid
 * show why under them, each removable, and "Remove invalid filters" fixes them all (deleted records leave the
 * condition with the ones that still exist).
 */
@Component({
	selector: 'ngx-task-views-filter-editor',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgTemplateOutlet,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		TranslatePipe
	],
	template: `
		<div class="filter-editor" data-test="filter-editor">
			@if (tree(); as root) {
				<ng-container *ngTemplateOutlet="groupTemplate; context: { $implicit: root, path: [] }"></ng-container>
			} @else {
				<p class="empty">{{ 'TASK_VIEWS.FILTER.NONE' | translate }}</p>
				@if (!disabled()) {
					<button
						nbButton
						size="tiny"
						status="basic"
						type="button"
						data-test="add-first-filter"
						(click)="add([])"
					>
						<nb-icon icon="plus-outline"></nb-icon>{{ 'TASK_VIEWS.FILTER.ADD' | translate }}
					</button>
				}
			}
			@if (invalid().size && !disabled()) {
				<button
					nbButton
					size="tiny"
					status="warning"
					ghost
					type="button"
					data-test="fix-invalid"
					(click)="fixAll()"
				>
					{{ 'TASK_VIEWS.FILTER.INVALID.FIX_ALL' | translate }}
				</button>
			}
		</div>

		<ng-template #groupTemplate let-group let-path="path">
			<div class="group" [class.nested]="path.length > 0" [attr.data-path]="key(path)">
				<div class="group-head">
					<nb-select
						size="tiny"
						class="op"
						[disabled]="disabled()"
						[selected]="group.op"
						(selectedChange)="setOp(path, $event)"
						[attr.aria-label]="'TASK_VIEWS.FILTER.JOIN' | translate"
					>
						<nb-option value="and">{{ 'TASK_VIEWS.FILTER.AND' | translate }}</nb-option>
						<nb-option value="or">{{ 'TASK_VIEWS.FILTER.OR' | translate }}</nb-option>
					</nb-select>
					@if (path.length > 0 && !disabled()) {
						<button
							nbButton
							ghost
							size="tiny"
							type="button"
							[attr.aria-label]="'TASK_VIEWS.FILTER.REMOVE_GROUP' | translate"
							(click)="remove(path)"
						>
							<nb-icon icon="close-outline"></nb-icon>
						</button>
					}
				</div>
				<ol class="conditions">
					@for (node of group.conditions; track $index; let index = $index) {
						<li>
							@if (isGroup(node)) {
								<ng-container
									*ngTemplateOutlet="
										groupTemplate;
										context: { $implicit: node, path: child(path, index) }
									"
								></ng-container>
							} @else {
								<ng-container
									*ngTemplateOutlet="
										conditionTemplate;
										context: { $implicit: node, path: child(path, index) }
									"
								></ng-container>
							}
						</li>
					}
				</ol>
				@if (!disabled()) {
					<div class="group-actions">
						<button
							nbButton
							size="tiny"
							ghost
							type="button"
							[disabled]="!canAddCondition()"
							(click)="add(path)"
						>
							<nb-icon icon="plus-outline"></nb-icon>{{ 'TASK_VIEWS.FILTER.ADD' | translate }}
						</button>
						@if (path.length + 1 <= maxDepth) {
							<button
								nbButton
								size="tiny"
								ghost
								type="button"
								[disabled]="!canAddGroup(path)"
								(click)="addNested(path, group.op)"
							>
								<nb-icon icon="layers-outline"></nb-icon>{{ 'TASK_VIEWS.FILTER.ADD_GROUP' | translate }}
							</button>
						}
					</div>
				}
			</div>
		</ng-template>

		<ng-template #conditionTemplate let-condition let-path="path">
			<div
				class="condition"
				[class.invalid]="invalidAt(path).length"
				[attr.data-path]="key(path)"
				data-test="filter-condition"
			>
				<nb-select
					size="tiny"
					class="field"
					[disabled]="disabled()"
					[selected]="condition.field"
					(selectedChange)="setField(path, $event)"
					[attr.aria-label]="'TASK_VIEWS.FILTER.FIELD' | translate"
				>
					@for (field of fields; track field) {
						<nb-option [value]="field">{{ fieldKey(field) | translate }}</nb-option>
					}
				</nb-select>
				<nb-select
					size="tiny"
					class="operator"
					[disabled]="disabled()"
					[selected]="condition.operator"
					(selectedChange)="setOperator(path, $event)"
					[attr.aria-label]="'TASK_VIEWS.FILTER.OPERATOR' | translate"
				>
					@for (operator of operatorsOf(condition.field); track operator) {
						<nb-option [value]="operator">{{ operatorKey(operator) | translate }}</nb-option>
					}
				</nb-select>
				@switch (condition.operator) {
					@case ('in') {
						<ng-container
							*ngTemplateOutlet="valuesTemplate; context: { $implicit: condition, path: path }"
						></ng-container>
					}
					@case ('notIn') {
						<ng-container
							*ngTemplateOutlet="valuesTemplate; context: { $implicit: condition, path: path }"
						></ng-container>
					}
					@case ('before') {
						<input
							nbInput
							fieldSize="tiny"
							type="date"
							[disabled]="disabled()"
							[value]="day(condition, 'to', 'before')"
							(change)="setBound(path, 'to', $any($event.target).value, 'before')"
							[attr.aria-label]="'TASK_VIEWS.FILTER.DATE_TO' | translate"
						/>
					}
					@case ('after') {
						<input
							nbInput
							fieldSize="tiny"
							type="date"
							[disabled]="disabled()"
							[value]="day(condition, 'from', 'from')"
							(change)="setBound(path, 'from', $any($event.target).value, 'from')"
							[attr.aria-label]="'TASK_VIEWS.FILTER.DATE_FROM' | translate"
						/>
					}
					@case ('between') {
						<input
							nbInput
							fieldSize="tiny"
							type="date"
							[disabled]="disabled()"
							[value]="day(condition, 'from', 'from')"
							(change)="setBound(path, 'from', $any($event.target).value, 'from')"
							[attr.aria-label]="'TASK_VIEWS.FILTER.DATE_FROM' | translate"
						/>
						<span class="and">{{ 'TASK_VIEWS.FILTER.JOIN_AND' | translate }}</span>
						<input
							nbInput
							fieldSize="tiny"
							type="date"
							[disabled]="disabled()"
							[value]="day(condition, 'to', 'until')"
							(change)="setBound(path, 'to', $any($event.target).value, 'until')"
							[attr.aria-label]="'TASK_VIEWS.FILTER.DATE_TO' | translate"
						/>
					}
					@case ('relative') {
						<nb-select
							size="tiny"
							class="direction"
							[disabled]="disabled()"
							[selected]="condition.relative?.direction ?? 'current'"
							(selectedChange)="setRelative(path, condition, { direction: $event })"
						>
							<nb-option value="current">{{
								'TASK_VIEWS.FILTER.RELATIVE.CURRENT' | translate
							}}</nb-option>
							<nb-option value="past">{{ 'TASK_VIEWS.FILTER.RELATIVE.PAST' | translate }}</nb-option>
							<nb-option value="future">{{ 'TASK_VIEWS.FILTER.RELATIVE.FUTURE' | translate }}</nb-option>
						</nb-select>
						@if ((condition.relative?.direction ?? 'current') !== 'current') {
							<input
								nbInput
								fieldSize="tiny"
								class="amount"
								type="number"
								min="1"
								max="366"
								[disabled]="disabled()"
								[value]="condition.relative?.amount ?? 1"
								(change)="setRelative(path, condition, { amount: +$any($event.target).value })"
								[attr.aria-label]="'TASK_VIEWS.FILTER.RELATIVE.AMOUNT' | translate"
							/>
						}
						<nb-select
							size="tiny"
							class="unit"
							[disabled]="disabled()"
							[selected]="condition.relative?.unit ?? 'week'"
							(selectedChange)="setRelative(path, condition, { unit: $event })"
						>
							<nb-option value="day">{{ 'TASK_VIEWS.FILTER.RELATIVE.DAY' | translate }}</nb-option>
							<nb-option value="week">{{ 'TASK_VIEWS.FILTER.RELATIVE.WEEK' | translate }}</nb-option>
							<nb-option value="month">{{ 'TASK_VIEWS.FILTER.RELATIVE.MONTH' | translate }}</nb-option>
						</nb-select>
					}
				}
				@if (!disabled()) {
					<button
						nbButton
						ghost
						size="tiny"
						type="button"
						class="remove"
						data-test="remove-condition"
						[attr.aria-label]="'TASK_VIEWS.FILTER.REMOVE' | translate"
						(click)="remove(path)"
					>
						<nb-icon icon="trash-2-outline"></nb-icon>
					</button>
				}
				@for (problem of invalidAt(path); track $index) {
					<p class="problem" role="alert" data-test="invalid-filter">
						<nb-icon icon="alert-triangle-outline" status="warning"></nb-icon>
						{{ invalidKey(problem.reason) | translate: { count: problem.values?.length ?? 0 } }}
						@if (!disabled()) {
							<button nbButton ghost size="tiny" status="warning" type="button" (click)="fixOne(path)">
								{{ 'TASK_VIEWS.FILTER.INVALID.FIX' | translate }}
							</button>
						}
					</p>
				}
			</div>
		</ng-template>

		<ng-template #valuesTemplate let-condition let-path="path">
			<nb-select
				size="tiny"
				class="values"
				multiple
				[disabled]="disabled()"
				[placeholder]="'TASK_VIEWS.FILTER.PICK' | translate"
				[selected]="condition.values ?? []"
				(selectedChange)="setValues(path, $event)"
				[attr.aria-label]="'TASK_VIEWS.FILTER.VALUES' | translate"
			>
				@for (option of choicesOf(condition); track option.id) {
					<nb-option [value]="option.id">{{
						option.label || ('TASK_VIEWS.FILTER.UNKNOWN' | translate)
					}}</nb-option>
				}
			</nb-select>
		</ng-template>
	`,
	styleUrl: './filter-editor.component.scss'
})
export class FilterEditorComponent {
	readonly tree = input<ITaskViewFilterGroup | null>(null);
	readonly options = input<TaskViewOptions>(EMPTY_OPTIONS);
	/** The invalid filters the platform reported, by the editor path of their condition. */
	readonly invalid = input<ReadonlyMap<string, ITaskViewInvalidFilter[]>>(new Map());
	readonly disabled = input(false);
	readonly treeChange = output<ITaskViewFilterGroup | null>();

	protected readonly fields = FILTER_FIELDS;
	protected readonly maxDepth = FILTER_MAX_DEPTH;
	protected readonly fieldKey = fieldKey;
	protected readonly operatorKey = operatorKey;
	protected readonly invalidKey = invalidKey;
	protected readonly operatorsOf = operatorsOf;
	protected readonly isGroup = isFilterGroup;
	protected readonly key = pathKey;

	protected readonly canAddCondition = computed(() => canAdd(this.tree(), 'condition'));

	protected child(path: FilterPath, index: number): number[] {
		return [...path, index];
	}

	protected canAddGroup(path: FilterPath): boolean {
		return canAdd(this.tree(), 'group', path);
	}

	protected invalidAt(path: FilterPath): ITaskViewInvalidFilter[] {
		return this.invalid().get(pathKey(path)) ?? [];
	}

	/** The records a condition can pick, with the ids it holds that are not among them kept (shown as unknown). */
	protected choicesOf(condition: ITaskViewFilterCondition): TaskViewOption[] {
		const options = optionsOfField(this.options(), condition.field);
		const known = new Set(options.map((option) => option.id));
		const unknown = (condition.values ?? []).filter((id) => !known.has(id)).map((id) => ({ id, label: '' }));
		return [...options, ...unknown];
	}

	protected day(
		condition: ITaskViewFilterCondition,
		bound: 'from' | 'to',
		kind: 'from' | 'before' | 'until'
	): string {
		return dayOfBound(condition, bound, kind);
	}

	protected add(groupPath: FilterPath): void {
		if (!canAdd(this.tree(), 'condition', groupPath)) return;
		this.emit(addCondition(this.tree(), groupPath, newCondition('status')));
	}

	protected addNested(groupPath: FilterPath, parentOp: 'and' | 'or'): void {
		if (!canAdd(this.tree(), 'group', groupPath)) return;
		this.emit(addGroup(this.tree(), groupPath, parentOp === 'and' ? 'or' : 'and', newCondition('status')));
	}

	protected remove(path: FilterPath): void {
		this.emit(removeNode(this.tree(), path));
	}

	protected setOp(path: FilterPath, op: 'and' | 'or'): void {
		const tree = this.tree();
		if (tree) this.emit(setGroupOp(tree, path, op));
	}

	protected setField(path: FilterPath, field: TaskViewFilterField): void {
		this.change(path, (condition) => withField(condition, field));
	}

	protected setOperator(path: FilterPath, operator: TaskViewFilterOperator): void {
		this.change(path, (condition) => withOperator(condition, operator));
	}

	protected setValues(path: FilterPath, values: ID[] | null): void {
		this.change(path, (condition) => withValues(condition, values ?? []));
	}

	/** A day picked in a date field: the instant of it in the reader's zone, and the day itself for date-only due dates. */
	protected setBound(path: FilterPath, bound: 'from' | 'to', day: string, kind: 'from' | 'before' | 'until'): void {
		this.change(path, (condition) => withPickedDay(condition, bound, day, kind));
	}

	protected setRelative(
		path: FilterPath,
		condition: ITaskViewFilterCondition,
		change: Partial<ITaskViewRelativeDate>
	): void {
		const current: ITaskViewRelativeDate = condition.relative ?? { unit: 'week', direction: 'current' };
		this.change(path, (node) => withRelative(node, { ...current, ...change }));
	}

	protected fixOne(path: FilterPath): void {
		const entries = this.invalid().get(pathKey(path));
		if (!entries) return;
		this.emit(withoutInvalid(this.tree(), new Map([[pathKey(path), entries]])));
	}

	protected fixAll(): void {
		this.emit(withoutInvalid(this.tree(), this.invalid()));
	}

	/** Whether a field takes dates (the template switches its inputs on it). */
	protected isDate(field: TaskViewFilterField): boolean {
		return fieldKindOf(field) === 'date';
	}

	private change(path: FilterPath, change: (condition: ITaskViewFilterCondition) => ITaskViewFilterCondition): void {
		const tree = this.tree();
		if (!tree) return;
		this.emit(updateNode(tree, path, (node) => (isFilterGroup(node) ? node : change(node))));
	}

	private emit(tree: ITaskViewFilterGroup | null): void {
		if (this.disabled()) return;
		this.treeChange.emit(tree);
	}
}
