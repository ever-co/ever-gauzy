import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { ListFilterStateService } from '@gauzy/ui-core/core';

/**
 * A column filter that comes back when the list is opened by the browser's Back or Forward button.
 *
 * A filter reports what the user chose through `applyFilter`, which also remembers it. When the list was opened by a
 * history step the filter reads that choice back as `restored` (for the template to show) and filters the list by
 * it, through the same path as a choice the user makes.
 */
@Component({
	template: '',
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export abstract class RestorableFilterComponent<T = unknown> extends DefaultFilter implements OnInit {
	private readonly _listFilterState = inject(ListFilterStateService);

	/** What the user had chosen when they left the list, for the template; null when the list is not restored. */
	protected restored: T | null = null;

	override ngOnInit(): void {
		super.ngOnInit();
		const restored = this._listFilterState.restore(this.column.id) as T | undefined;
		if (restored !== undefined) {
			this.restored = restored;
			this.column.filterFunction(restored, this.column.id);
		}
	}

	/** The user chose `value` (null or empty clears the filter). */
	protected applyFilter(value: T | null): void {
		this._listFilterState.record(this.column.id, value);
		this.column.filterFunction(value, this.column.id);
	}
}
