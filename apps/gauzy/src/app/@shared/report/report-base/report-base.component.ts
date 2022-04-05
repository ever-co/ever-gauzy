import { Component } from '@angular/core';
import { combineLatest, debounceTime } from 'rxjs';
import { Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import * as moment from 'moment';
import { IOrganization, ISelectedDateRange, ITimeLogFilters } from '@gauzy/contracts';
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
	request: ITimeLogFilters = {
		employeeIds: [],
		projectIds: []
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
				filter(([organization]) => !!organization),
				debounceTime(300),
				distinctUntilChange(),
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
						this.subject$.next(true);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getFilterRequest(request: ITimeLogFilters): ITimeLogFilters {
		const { startDate, endDate } = this.getAdjustDateRangeFutureAllowed(request);
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

	/**
	 * We are having issue, when organization not allowed future date
	 * When someone run timer for today, all statistic not displaying correctly
	 *
	 * @returns
	 */
	protected getAdjustDateRangeFutureAllowed(request: ITimeLogFilters): ISelectedDateRange {
		const now = moment();
		let { startDate, endDate } = request;
		/**
		 * If, user selected single day date range.
		 */
		if (
			moment(moment(startDate).format('YYYY-MM-DD')).isSame(
				moment(endDate).format('YYYY-MM-DD')
			)
		) {
			startDate = moment(startDate).startOf('day').utc().toDate();
			endDate = moment(endDate).endOf('day').utc().toDate();
		}

		/**
		 * If, user selected TODAY date range.
		 */
		if (
			moment(now.format('YYYY-MM-DD')).isSame(
				moment(endDate).format('YYYY-MM-DD')
			)
		) {
			endDate = moment.utc().toDate();
		}
		return {
			startDate: moment(startDate).toDate(),
			endDate: moment(endDate).toDate()
		} as ISelectedDateRange
	}
}
