import { Injectable } from '@angular/core';
import { ICountsStatistics, IGetCountsStatistics, IGetTimeLogInput, ReportDayData } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { RequestQuery } from '../../+state/request/request.query';
import { Store, TimeTrackerDateManager, ToastrNotificationService } from '../../../services';
import { TimesheetService, TimesheetStatisticsService } from '../../services/timesheet';
import { moment } from '../../shared/features/date-range-picker';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';
import { WeeklyRecapQuery } from './weekly.query';
import { IWeeklyRecapState, WeeklyRecapStore } from './weekly.store';

@Injectable({
	providedIn: 'root'
})
export class WeeklyRecapService {
	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly timesheetService: TimesheetService,
		private readonly notificationService: ToastrNotificationService,
		private readonly weeklyQuery: WeeklyRecapQuery,
		private readonly weeklyStore: WeeklyRecapStore,
		private readonly requestQuery: RequestQuery,
		private readonly store: Store
	) {}

	public update(state: Partial<IWeeklyRecapState>) {
		this.weeklyStore.update(state);
	}

	public get state$(): Observable<IWeeklyRecapState> {
		return this.weeklyQuery.state$;
	}

	public get range$(): Observable<IDateRangePicker> {
		return this.weeklyQuery.range$;
	}

	public get range(): IDateRangePicker {
		return this.weeklyQuery.getValue().range;
	}

	public get count(): ICountsStatistics {
		return this.weeklyQuery.getValue().count;
	}

	public get weeklyActivities(): ReportDayData[] {
		return this.weeklyQuery.getValue().weeklyActivities;
	}

	public async getWeeklyActivities(): Promise<void> {
		try {
			this.weeklyStore.setLoading(true);
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
				unitOfTime: 'week'
			};
			const weeklyActivities = await this.timesheetService.getWeeklyReportChart(request);
			this.weeklyStore.update({ weeklyActivities });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.weeklyStore.setError(error);
		} finally {
			this.weeklyStore.setLoading(false);
		}
	}

	public async getCounts(): Promise<void> {
		try {
			this.weeklyStore.setLoading(true);
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
			this.weeklyStore.update({ count: { ...count, reWeeklyLimit: user.employee.reWeeklyLimit } });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.weeklyStore.setError(error);
		} finally {
			this.weeklyStore.setLoading(false);
		}
	}
}
