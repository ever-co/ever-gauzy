import { Component, OnInit, OnDestroy, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DefaultFilter } from 'angular2-smart-table';
import { CustomFilterConfig } from '@gauzy/contracts';

@Component({
	selector: 'ga-date-filter',
	template: `
		<div class="d-flex align-items-center">
			<input
				nbInput
				[nbDatepicker]="datePicker"
				[formControl]="dateControl"
				placeholder="{{ column.title }}"
				fullWidth
			/>
			<nb-datepicker #datePicker></nb-datepicker>
		</div>
	`,
	standalone: false
})
export class DateFilterComponent extends DefaultFilter implements OnInit, OnDestroy {
	dateControl = new FormControl();
	private readonly destroy$ = new Subject<void>();

	ngOnInit() {
		const config = this.column?.filter?.config as CustomFilterConfig;
		if (config?.initialValueInput) this.dateControl.setValue(config.initialValueInput, { emitEvent: false });

		this.dateControl.valueChanges
			.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
			.subscribe((val) => {
				this.column.filterFunction(val?.toISOString?.() || null, this.column.id);
			});
	}

	ngOnChanges(changes: SimpleChanges): void {
		// Required for angular2-smart-table, even if unused
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
