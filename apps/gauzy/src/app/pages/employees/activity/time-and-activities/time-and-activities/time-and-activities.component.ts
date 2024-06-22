import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { ITimeLogFilters } from '@gauzy/contracts';
import { DateRangePickerBuilderService, TimesheetFilterService } from '@gauzy/ui-core/core';
import { i4netFiltersComponent } from '@gauzy/ui-core/shared';

@Component({
	selector: 'gauzy-time-and-activities',
	templateUrl: './time-and-activities.component.html',
	styleUrls: ['./time-and-activities.component.scss']
})
export class TimeAndActivitiesComponent implements OnInit {
	filters: ITimeLogFilters;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	@ViewChild(i4netFiltersComponent) gauzyFiltersComponent: i4netFiltersComponent;

	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) { }

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
	}

	ngOnInit(): void { }
}
