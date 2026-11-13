import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	output
} from '@angular/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ID, ITask } from '@gauzy/contracts';
import { dueDateShown, dueDeadline } from '@gauzy/ui-core/common';
import { isSelected, pageSelectionState, TaskSelection, EMPTY_SELECTION } from '../../models/selection';
import { taskReferenceOf } from '../../models/task-reference';
import { humanize, personName } from '../../services/task-views-options.service';

/** One group of rows as the list shows it: its name, the platform's count, and the rows loaded so far. */
export interface TaskRowGroup {
	key: string;
	label: string;
	count: number | null;
	rows: ITask[];
}

/** A row clicked (or its checkbox): Shift held selects a range from the anchor. */
export interface RowToggle {
	id: ID;
	shift: boolean;
}

/** A drop of the manual order: indexes in the page's rows. */
export interface RowDrop {
	from: number;
	to: number;
}

/** Whether a task's due date has passed (and it is not done). A date-only due date passes once its day has ended. */
export function isOverdue(task: Pick<ITask, 'dueDate' | 'status'>, now = Date.now()): boolean {
	const due = dueDeadline(task.dueDate);
	return due !== null && due < now && !['done', 'completed', 'cancelled'].includes(String(task.status ?? ''));
}

/** Two letters for a person without a picture. */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/**
 * The rows of a view: a checkbox each (Shift-click selects a range), the reference (`API-42`), the title, and the
 * properties the view shows; grouped under headers with the platform's counts. With a manual order the rows drag.
 * The focused row (J / K) is scrolled into view; Enter or a click on the title opens the task.
 */
@Component({
	selector: 'ngx-task-views-task-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CdkDrag, CdkDragHandle, CdkDropList, DatePipe, NbIconModule, NbTooltipModule, TranslatePipe],
	templateUrl: './task-list.component.html',
	styleUrl: './task-list.component.scss'
})
export class TaskListComponent {
	private readonly host = inject(ElementRef<HTMLElement>);

	readonly groups = input<TaskRowGroup[]>([]);
	readonly grouped = input(false);
	readonly selection = input<TaskSelection>(EMPTY_SELECTION);
	readonly focusedId = input<ID | null>(null);
	/** The row properties shown, by name. */
	readonly shown = input<Record<string, boolean>>({});
	readonly draggable = input(false);
	readonly selectable = input(true);

	readonly toggled = output<RowToggle>();
	readonly opened = output<ID>();
	readonly focused = output<ID>();
	readonly dropped = output<RowDrop>();
	readonly pageToggled = output<boolean>();

	protected readonly reference = taskReferenceOf;
	protected readonly humanize = humanize;
	protected readonly personName = personName;
	protected readonly initialsOf = initialsOf;
	protected readonly isOverdue = isOverdue;
	protected readonly dueDateShown = dueDateShown;

	/** Every row once, in the order shown: what the page checkbox and the drop indexes read. */
	protected readonly order = computed(() => {
		const seen = new Set<ID>();
		const ids: ID[] = [];
		for (const group of this.groups()) {
			for (const row of group.rows) {
				const id = row.id as ID;
				if (!seen.has(id)) {
					seen.add(id);
					ids.push(id);
				}
			}
		}
		return ids;
	});

	protected readonly pageState = computed(() => pageSelectionState(this.selection(), this.order()));

	constructor() {
		afterRenderEffect(() => {
			const id = String(this.focusedId() ?? '');
			if (!/^[\w-]+$/.test(id)) return;
			const row = (this.host.nativeElement as HTMLElement).querySelector?.(
				`[data-task-id="${id}"]`
			) as HTMLElement | null;
			row?.scrollIntoView?.({ block: 'nearest' });
		});
	}

	protected selected(id: ID | undefined): boolean {
		return !!id && isSelected(this.selection(), id);
	}

	protected show(property: string): boolean {
		return this.shown()[property] ?? false;
	}

	protected onCheck(event: MouseEvent, id: ID | undefined): void {
		if (!id) return;
		event.stopPropagation();
		this.toggled.emit({ id, shift: event.shiftKey });
		// The box shows the selection the page answers (a full selection refuses the row), not the click: once the
		// page has answered, the box is set to it, since a binding whose value did not change does not touch the DOM.
		this.syncBox(event.target, () => this.selected(id));
	}

	protected onRowClick(event: MouseEvent, id: ID | undefined): void {
		if (!id) return;
		this.focused.emit(id);
		if (event.shiftKey && this.selectable()) {
			event.preventDefault();
			this.toggled.emit({ id, shift: true });
		}
	}

	protected open(event: Event, id: ID | undefined): void {
		event.preventDefault();
		event.stopPropagation();
		if (id) this.opened.emit(id);
	}

	protected togglePage(event: Event): void {
		this.pageToggled.emit(this.pageState() !== 'all');
		this.syncBox(
			event.target,
			() => this.pageState() === 'all',
			() => this.pageState() === 'some'
		);
	}

	private syncBox(target: EventTarget | null, checked: () => boolean, indeterminate?: () => boolean): void {
		const box = target as HTMLInputElement | null;
		if (!box || typeof box.checked !== 'boolean') return;
		setTimeout(() => {
			box.checked = checked();
			if (indeterminate) box.indeterminate = indeterminate();
		});
	}

	protected drop(event: CdkDragDrop<unknown>): void {
		if (event.previousIndex === event.currentIndex) return;
		this.dropped.emit({ from: event.previousIndex, to: event.currentIndex });
	}

	protected trackRow(row: ITask): ID {
		return row.id as ID;
	}
}
