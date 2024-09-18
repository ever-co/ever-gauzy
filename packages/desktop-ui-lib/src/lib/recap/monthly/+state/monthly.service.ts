import { Injectable } from '@angular/core';
import { ICountsStatistics, IGetCountsStatistics, IGetTimeLogInput, ReportDayData } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { RequestQuery } from '../../+state/request/request.query';
import { Store, TimeTrackerDateManager, ToastrNotificationService } from '../../../services';
import { TimesheetService, TimesheetStatisticsService } from '../../services/timesheet';
import { moment } from '../../shared/features/date-range-picker';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';
import { MonthlyRecapQuery } from './monthly.query';
import { IMonthlyRecapState, MonthlyRecapStore } from './monthly.store';

@Injectable({
	providedIn: 'root'
})
export class MonthlyRecapService {
	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly timesheetService: TimesheetService,
		private readonly notificationService: ToastrNotificationService,
		private readonly monthlyQuery: MonthlyRecapQuery,
		private readonly monthlyStore: MonthlyRecapStore,
		private readonly requestQuery: RequestQuery,
		private readonly store: Store
	) {}

	public update(state: Partial<IMonthlyRecapState>) {
		this.monthlyStore.update(state);
	}

	public get state$(): Observable<IMonthlyRecapState> {
		return this.monthlyQuery.state$;
	}

	public get range$(): Observable<IDateRangePicker> {
		return this.monthlyQuery.range$;
	}

	public get range(): IDateRangePicker {
		return this.monthlyQuery.getValue().range;
	}

	public get count(): ICountsStatistics {
		return this.monthlyQuery.getValue().count;
	}

	public get monthlyActivities(): ReportDayData[] {
		return this.monthlyQuery.getValue().monthlyActivities;
	}

	public async getMonthActivities(): Promise<void> {
		try {
			this.monthlyStore.setLoading(true);
			const { organizationId, tenantId, user } = this.store;
			const employeeIds = [user.employee.id];
			const timeZone = user.timeZone || moment.tz.guess();
			const timeFormat = user.timeFormat;
			const request: IGetTimeLogInput = {
				...this.requestQuery.request,
				...this.range,
				organizationId,
				employeeIds,
				tenantId,
				timeFormat,
				timeZone,
				unitOfTime: 'month'
			};
			const monthlyActivities = await this.timesheetService.getWeeklyReportChart(request);
			this.monthlyStore.update({ monthlyActivities });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.monthlyStore.setError(error);
		} finally {
			this.monthlyStore.setLoading(false);
		}
	}

	public async getCounts(): Promise<void> {
		try {
			this.monthlyStore.setLoading(true);
			const { organizationId, tenantId, user } = this.store;
			const employeeIds = [user.employee.id];
			const request: IGetCountsStatistics = {
				...this.requestQuery.request,
				...this.range,
				organizationId,
				employeeIds,
				onlyMe: true,
				tenantId,
				todayStart: TimeTrackerDateManager.startToday,
				todayEnd: TimeTrackerDateManager.endToday
			};
			const count = await this.timesheetStatisticsService.getCounts(request);
			this.monthlyStore.update({ count });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.monthlyStore.setError(error);
		} finally {
			this.monthlyStore.setLoading(false);
		}
	}
}
