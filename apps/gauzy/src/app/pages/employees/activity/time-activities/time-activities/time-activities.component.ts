import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { ITimeLogFilters, ReportGroupByFilter, ReportGroupFilterEnum } from '@gauzy/contracts';
import { DateRangePickerBuilderService, TimesheetFilterService } from '@gauzy/ui-core/core';
import { DailyGridComponent, GauzyFiltersComponent, ReportExportFormatEnum } from '@gauzy/ui-core/shared';

@Component({
	selector: 'gauzy-time-activities',
	templateUrl: './time-activities.component.html',
	styleUrls: ['./time-activities.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TimeActivitiesComponent implements OnInit {
	filters: ITimeLogFilters;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	readonly ReportGroupFilterEnum = ReportGroupFilterEnum;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	@ViewChild(DailyGridComponent) dailyGrid: DailyGridComponent;

	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {}

	/**
	 * Whether the report has rows to export: the grid has finished loading and found time entries.
	 */
	get canExport(): boolean {
		return !!this.dailyGrid?.canExport;
	}

	/**
	 * Downloads the time entries the grid shows — for the current filters, in the selected grouping — as a
	 * CSV file named after the selected date range.
	 */
	exportToCsv(): void {
		this.dailyGrid?.exportReport(ReportExportFormatEnum.CSV);
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
	}

	ngOnInit(): void {}
}
