import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	output,
	signal,
	ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ITaskBulkChanges } from '@gauzy/contracts';
import { BulkAction, dueDateChanges, priorityChanges, sizeChanges, statusChanges } from '../../models/bulk-undo';
import { EMPTY_OPTIONS, TaskViewOption, TaskViewOptions } from '../../services/task-views-options.service';

/** The pickers of the toolbar. */
export type BulkPicker = 'status' | 'priority' | 'size' | 'assignees' | 'labels' | 'project' | 'dueDate';

/** A change the toolbar asks for: what changes, for the toast, and the platform's changes. */
export interface BulkApply {
	action: BulkAction;
	changes: ITaskBulkChanges;
}

const PICKER_OPTIONS: Readonly<Record<Exclude<BulkPicker, 'dueDate'>, keyof TaskViewOptions>> = {
	status: 'status',
	priority: 'priority',
	size: 'size',
	assignees: 'assignees',
	labels: 'labels',
	project: 'project'
};

/** The options of a picker that match a search (every word, any case). */
export function filterOptions(options: readonly TaskViewOption[], search: string): TaskViewOption[] {
	const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return [...options];
	return options.filter((option) => words.every((word) => option.label.toLowerCase().includes(word)));
}

/**
 * The bulk toolbar over the selection: how many are selected, and status, priority, size, assignees and labels (add
 * or remove), project, due date, archive and delete for all of them at once. Each pick answers the platform's
 * changes; the page sends them in one request and offers the undo.
 */
@Component({
	selector: 'ngx-task-views-bulk-toolbar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbIconModule, NbInputModule, NbTooltipModule, TranslatePipe],
	templateUrl: './bulk-toolbar.component.html',
	styleUrl: './bulk-toolbar.component.scss'
})
export class BulkToolbarComponent {
	readonly count = input(0);
	readonly limit = input(100);
	readonly options = input<TaskViewOptions>(EMPTY_OPTIONS);
	readonly busy = input(false);
	readonly canEdit = input(true);
	readonly canDelete = input(true);

	readonly applied = output<BulkApply>();
	readonly deleted = output<void>();
	readonly cleared = output<void>();

	@ViewChild('searchInput') private searchField?: ElementRef<HTMLInputElement>;
	@ViewChild('dueField') private dueField?: ElementRef<HTMLInputElement>;

	private readonly host = inject(ElementRef<HTMLElement>);
	private opener: HTMLElement | null = null;
	private lastPicker: BulkPicker | null = null;

	protected readonly picker = signal<BulkPicker | null>(null);
	protected readonly search = signal('');
	protected readonly listMode = signal<'add' | 'remove'>('add');
	protected readonly due = signal('');

	protected readonly pickers: readonly BulkPicker[] = [
		'status',
		'priority',
		'size',
		'assignees',
		'labels',
		'project',
		'dueDate'
	];

	protected readonly choices = computed(() => {
		const picker = this.picker();
		if (!picker || picker === 'dueDate') return [];
		return filterOptions(this.options()[PICKER_OPTIONS[picker]] ?? [], this.search());
	});

	protected pickerKey(picker: BulkPicker): string {
		return `TASK_VIEWS.BULK.${picker.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
	}

	/** Opens a picker (the `S`, `P`, `L` and `D` keys do too); the same one again closes it. */
	openPicker(picker: BulkPicker): void {
		if (!this.canEdit() || this.busy()) return;
		if (this.picker() === picker) {
			this.closePicker(true);
			return;
		}
		// The control that opened the picker gets the focus back when it closes (its trigger, or what had the focus).
		const active = (this.host.nativeElement as HTMLElement).ownerDocument?.activeElement as HTMLElement | null;
		this.opener = active && active !== document.body ? active : null;
		this.lastPicker = picker;
		this.picker.set(picker);
		this.search.set('');
		this.listMode.set('add');
		this.due.set('');
		setTimeout(() => (picker === 'dueDate' ? this.dueField : this.searchField)?.nativeElement.focus());
	}

	/** Closes the picker; `restoreFocus` gives the focus back to what opened it (else the picker's own trigger). */
	closePicker(restoreFocus = false): void {
		if (this.picker() === null) return;
		this.picker.set(null);
		if (!restoreFocus) return;
		const root = this.host.nativeElement as HTMLElement;
		const opener = this.opener && this.opener.isConnected ? this.opener : null;
		const trigger = this.lastPicker ? root.querySelector<HTMLElement>(`[data-picker="${this.lastPicker}"]`) : null;
		setTimeout(() => (opener ?? trigger)?.focus());
	}

	get isPickerOpen(): boolean {
		return this.picker() !== null;
	}

	protected choose(option: TaskViewOption): void {
		const picker = this.picker();
		if (!picker) return;
		const named = { id: option.id, value: option.value ?? option.label, name: option.value ?? option.label };
		switch (picker) {
			case 'status':
				this.emit('status', statusChanges(named));
				break;
			case 'priority':
				this.emit('priority', priorityChanges(named));
				break;
			case 'size':
				this.emit('size', sizeChanges(named));
				break;
			case 'project':
				this.emit('project', { projectId: option.id });
				break;
			case 'assignees':
				this.emit(
					'assignees',
					this.listMode() === 'add' ? { addMemberIds: [option.id] } : { removeMemberIds: [option.id] }
				);
				break;
			case 'labels':
				this.emit(
					'labels',
					this.listMode() === 'add' ? { addTagIds: [option.id] } : { removeTagIds: [option.id] }
				);
				break;
		}
	}

	protected clearProject(): void {
		this.emit('project', { projectId: null });
	}

	protected applyDue(clear = false): void {
		if (clear) {
			this.emit('dueDate', dueDateChanges(null));
			return;
		}
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(this.due());
		if (!match) return;
		this.emit('dueDate', dueDateChanges(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
	}

	protected archive(): void {
		this.emit('archive', { isArchived: true });
	}

	protected onPanelKeydown(event: KeyboardEvent): void {
		// A key that confirms or cancels text an input method is composing (Enter, Escape) belongs to that text.
		// Safari marks the Enter that ends a composition by its key code (229) alone, not by `isComposing`.
		if (event.isComposing || event.keyCode === 229) return;
		if (event.key === 'Escape') {
			event.stopPropagation();
			this.closePicker(true);
			return;
		}
		// Enter in the search picks the first match; Enter on a focused button does what that button does.
		if (event.key === 'Enter' && this.picker() !== 'dueDate' && event.target === this.searchField?.nativeElement) {
			const [first] = this.choices();
			if (first) {
				event.preventDefault();
				this.choose(first);
			}
		}
	}

	private emit(action: BulkAction, changes: ITaskBulkChanges): void {
		this.closePicker(true);
		this.applied.emit({ action, changes });
	}
}
