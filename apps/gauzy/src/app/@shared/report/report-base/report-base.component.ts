import { Component } from '@angular/core';
import { combineLatest } from 'rxjs';
import { Subject } from 'rxjs/internal/Subject';
import { filter, tap } from 'rxjs/operators';
import * as moment from 'moment';
import { IOrganization, ITimeLogFilters } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import { pick } from 'underscore';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class ReportBaseComponent extends TranslationBaseComponent {
	today: Date = new Date();
	request: ITimeLogFilters = {
		startDate: moment(this.today).startOf('week').toDate(),
		endDate: moment(this.today).endOf('week').toDate()
	};
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	constructor(
		protected readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService);
		this.onInit();
	}

	onInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				tap(([organization, employee, project]) => {
					if (organization) {
						if (employee && employee.id) {
							this.request.employeeIds = [employee.id];
						} else {
							delete this.request.employeeIds;
						}
						if (project && project.id) {
							this.request.projectIds = [project.id];
						} else {
							delete this.request.projectIds;
						}
						this.subject$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getFilterRequest(request: ITimeLogFilters) {
		const { startDate, endDate } = request;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const selectorFilters = pick(this.request, 'projectIds', 'employeeIds');

		const filterRequest: ITimeLogFilters = {
			...selectorFilters,
			organizationId,
			tenantId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
		};
		return filterRequest;
	}
}
