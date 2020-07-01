import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Subject } from 'rxjs';
import {
	Organization,
	TimeLogFilters,
	IGetActivitiesInput,
	Activity,
	ActivityType
} from '@gauzy/models';
import { debounceTime } from 'rxjs/operators';
import { toUTC } from 'libs/utils';
import { ActivityService } from 'apps/gauzy/src/app/@shared/timesheet/activity.service';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'ngx-app',
	templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
	loading: boolean;
	apps: Activity[];
	request: any;
	updateLogs$: Subject<any> = new Subject();
	organization: Organization;
	type: 'apps' | 'urls';

	constructor(
		private store: Store,
		private activatedRoute: ActivatedRoute,
		private activityService: ActivityService
	) {}

	ngOnInit(): void {
		this.activatedRoute.params.subscribe((params) => {
			if (params.type) {
				this.type = params.type;
				this.updateLogs$.next();
			}
		});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
				this.updateLogs$.next();
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});
	}

	prgressStatus(value) {
		if (value <= 25) {
			return 'danger';
		} else if (value <= 50) {
			return 'warning';
		} else if (value <= 75) {
			return 'info';
		} else {
			return 'success';
		}
	}

	async filtersChange($event: TimeLogFilters) {
		this.request = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization) {
			return;
		}

		const { employeeId, startDate, endDate } = this.request;

		const request: IGetActivitiesInput = {
			organizationId: this.organization.id,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			type: this.type === 'apps' ? ActivityType.APP : ActivityType.URL
		};

		this.loading = true;
		this.activityService
			.getActivites(request)
			.then((activities) => {
				this.apps = activities;
			})
			.finally(() => (this.loading = false));
	}

	ngOnDestroy(): void {}
}
