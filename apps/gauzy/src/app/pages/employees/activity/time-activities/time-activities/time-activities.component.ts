import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { ITimeLogFilters } from '@gauzy/contracts';
import { DateRangePickerBuilderService, TimesheetFilterService } from '@gauzy/ui-core/core';
import { GauzyFiltersComponent } from '@gauzy/ui-core/shared';

@Component({
    selector: 'gauzy-time-activities',
    templateUrl: './time-activities.component.html',
    styleUrls: ['./time-activities.component.scss'],
    standalone: false
})
export class TimeActivitiesComponent implements OnInit {
	filters: ITimeLogFilters;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
	}

	ngOnInit(): void {}
}
