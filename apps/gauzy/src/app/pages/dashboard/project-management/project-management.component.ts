import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { IDateRangePicker, IOrganization } from '@gauzy/contracts';
import { Store } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-management',
	templateUrl: './project-management.component.html',
  	styleUrls:['./project-management.component.scss']
})
export class ProjectManagementComponent implements OnInit, OnDestroy {

	organization: IOrganization;
	selectedDateRange: IDateRangePicker;

	constructor(
		private readonly store: Store
	) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.store.selectedDateRange$;

		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				debounceTime(500),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
