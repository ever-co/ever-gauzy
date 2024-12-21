import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IDateRangePicker, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-project-management',
    templateUrl: './project-management.component.html',
    styleUrls: ['./project-management.component.scss'],
    standalone: false
})
export class ProjectManagementComponent implements OnInit, OnDestroy {
	public organization: IOrganization;
	public selectedDateRange: IDateRangePicker;

	constructor(
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;

		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				debounceTime(500),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange]) => {
					this.organization = organization as IOrganization;
					this.selectedDateRange = dateRange as IDateRangePicker;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
