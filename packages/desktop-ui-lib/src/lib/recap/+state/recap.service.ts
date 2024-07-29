import { Injectable } from '@angular/core';
import {
	IGetActivitiesStatistics,
	IGetCountsStatistics,
	IGetProjectsStatistics,
	IGetTasksStatistics,
	IGetTimeSlotInput
} from '@gauzy/contracts';
import { reduce } from 'underscore';
import { Store, ToastrNotificationService } from '../../services';
import { TimesheetService, TimesheetStatisticsService } from '../services/timesheet';
import { RecapQuery } from './recap.query';
import { RecapStore } from './recap.store';
import { RequestQuery } from './request/request.query';

@Injectable({ providedIn: 'root' })
export class RecapService {
	constructor(
		private readonly recapStore: RecapStore,
		private readonly recapQuery: RecapQuery,
		private readonly requestQuery: RequestQuery,
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		private readonly timesheetService: TimesheetService,
		private readonly notificationService: ToastrNotificationService,
		private readonly store: Store
	) {}
	public async getActivities(): Promise<void> {
		try {
			this.recapStore.setLoading(true);
			const { organizationId, tenantId } = this.store;
			const request: IGetActivitiesStatistics = {
				...this.requestQuery.request,
				...this.recapQuery.range,
				organizationId,
				onlyMe: true,
				tenantId
			};
			const results = await this.timesheetStatisticsService.getActivities(request);
			const sum = reduce(results, (memo, activity) => memo + parseInt(activity.duration + '', 10), 0);
			const activities = (results || []).map((activity) => {
				activity.durationPercentage = (activity.duration * 100) / sum;
				return activity;
			});
			this.recapStore.update({ activities });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching activities.');
			this.recapStore.setError(error);
		} finally {
			this.recapStore.setLoading(false);
		}
	}

	public async getProjects(): Promise<void> {
		try {
			this.recapStore.setLoading(true);
			const { organizationId, tenantId } = this.store;
			const request: IGetProjectsStatistics = {
				...this.requestQuery.request,
				...this.recapQuery.range,
				organizationId,
				onlyMe: true,
				tenantId
			};
			const projects = await this.timesheetStatisticsService.getProjects(request);
			this.recapStore.update({ projects });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching projects.');
			this.recapStore.setError(error);
		} finally {
			this.recapStore.setLoading(false);
		}
	}

	public async getTasks(): Promise<void> {
		try {
			this.recapStore.setLoading(true);
			const { organizationId, tenantId, user } = this.store;
			const { employeeId } = user.employee;
			const request: IGetTasksStatistics = {
				...this.requestQuery.request,
				...this.recapQuery.range,
				organizationId,
				onlyMe: true,
				employeeId,
				tenantId
			};
			const tasks = await this.timesheetStatisticsService.getTasksStatistics(request);
			this.recapStore.update({ tasks });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.recapStore.setError(error);
		} finally {
			this.recapStore.setLoading(false);
		}
	}

	public async getTimeSlots(): Promise<void> {
		try {
			this.recapStore.setLoading(true);
			const { organizationId, tenantId } = this.store;
			const request: IGetTimeSlotInput = {
				...this.requestQuery.request,
				...this.recapQuery.range,
				organizationId,
				onlyMe: true,
				tenantId
			};
			const timeSlots = await this.timesheetService.getTimeSlots(request);
			this.recapStore.update({ timeSlots });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.recapStore.setError(error);
		} finally {
			this.recapStore.setLoading(false);
		}
	}

	public async getCounts(): Promise<void> {
		try {
			this.recapStore.setLoading(true);
			const { organizationId, tenantId } = this.store;
			const request: IGetCountsStatistics = {
				...this.requestQuery.request,
				...this.recapQuery.range,
				organizationId,
				onlyMe: true,
				tenantId
			};
			const count = await this.timesheetStatisticsService.getCounts(request);
			this.recapStore.update({ count });
		} catch (error) {
			this.notificationService.error(error.message || 'An error occurred while fetching tasks.');
			this.recapStore.setError(error);
		} finally {
			this.recapStore.setLoading(false);
		}
	}
}