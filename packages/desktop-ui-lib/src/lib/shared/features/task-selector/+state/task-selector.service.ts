import { Injectable } from '@angular/core';
import { ITask, ITasksStatistics, TaskStatusEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import moment from 'moment';;
import { TimeTrackerService } from '../../../../time-tracker/time-tracker.service';
import { SelectorService } from '../../../+state/selector.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { ProjectSelectorQuery } from '../../project-selector/+state/project-selector.query';
import { TeamSelectorQuery } from '../../team-selector/+state/team-selector.query';
import { TaskSelectorQuery } from './task-selector.query';
import { TaskSelectorStore } from './task-selector.store';

@Injectable({
	providedIn: 'root'
})
export class TaskSelectorService extends SelectorService<ITask> {
	constructor(
		public readonly taskSelectorStore: TaskSelectorStore,
		public readonly taskSelectorQuery: TaskSelectorQuery,
		private readonly projectSelectorQuery: ProjectSelectorQuery,
		private readonly teamSelectorQuery: TeamSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly translateService: TranslateService,
		public readonly store: Store
	) {
		super(taskSelectorStore, taskSelectorQuery);
	}

	public get selectedId(): ITask['id'] {
		return this.taskSelectorQuery.selectedId;
	}

	public async addNewTask(title: ITask['title']): Promise<void> {
		if (!title) {
			return;
		}
		this.taskSelectorStore.setLoading(true);
		const { tenantId, organizationId, user, statuses } = this.store;
		const taskStatus = statuses.find((status) => status.isInProgress);
		const data = {
			tenantId,
			organizationId,
			projectId: this.projectSelectorQuery.selectedId
		};
		try {
			const member = { ...user.employee };
			const task: any = await this.timeTrackerService.saveNewTask(data, {
				title,
				organizationId,
				tenantId,
				taskStatus,
				status: TaskStatusEnum.IN_PROGRESS,
				dueDate: moment().add(1, 'day').utc().toDate(),
				estimate: 3600,
				...(member.id && { members: [member] }),
				...(this.projectSelectorQuery.selectedId && {
					projectId: this.projectSelectorQuery.selectedId
				})
			});
			this.taskSelectorStore.appendData(task);
			this.toastrNotifier.success(this.translateService.instant('TIMER_TRACKER.TOASTR.TASK_ADDED'));
			this.taskSelectorStore.setError(null);
		} catch (error) {
			console.error('ERROR', error);
			this.taskSelectorStore.setError(error);
		} finally {
			this.taskSelectorStore.setLoading(false);
		}
	}

	public async load(options?: { searchTerm?: string; projectId?: string }): Promise<void> {
		try {
			this.taskSelectorStore.setLoading(true);
			const { searchTerm } = options || {};
			const {
				organizationId,
				tenantId,
				user: {
					employee: { id: employeeId }
				}
			} = this.store;
			const request = {
				organizationId,
				tenantId,
				searchTerm,
				projectId: this.projectSelectorQuery.selectedId,
				organizationTeamId: this.teamSelectorQuery.selectedId,
				take: this.taskSelectorQuery.limit,
				skip: this.taskSelectorQuery.page,
				employeeId,
				...options
			};
			const { total, items: tasks } = await this.timeTrackerService.getPaginatedTasks(request);
			if (tasks.length) {
				const statistics = await this.timeTrackerService.getTasksStatistics({
					...request,
					taskIds: tasks.map((task) => task.id)
				});
				const data = this.merge(tasks, statistics);
				this.taskSelectorStore.updateInfiniteList({ data, total });
			} else {
				this.taskSelectorStore.update({ data: [], total: 0 });
			}
			this.taskSelectorStore.setError(null);
		} catch (error) {
			this.toastrNotifier.error(error.message || 'An error occurred while fetching tasks.');
			this.taskSelectorStore.setError(error);
		} finally {
			this.taskSelectorStore.setLoading(false);
		}
	}

	public merge(tasks: ITask[], statistics: ITasksStatistics[]): (ITask & ITasksStatistics)[] {
		let arr: (ITask & ITasksStatistics)[] = [];
		arr = arr.concat(statistics, tasks);
		return arr.reduce((result, current) => {
			const existing = result.find((item: any) => item.id === current.id);
			if (existing) {
				const updatedAtMoment = moment(existing?.updatedAt, moment.ISO_8601).utc(true);
				Object.assign(
					existing,
					current,
					updatedAtMoment.isAfter(current?.updatedAt)
						? {
								updatedAt: updatedAtMoment.toISOString()
						  }
						: {}
				);
			} else {
				result.push(current);
			}
			return result.filter((task) => !!task?.id);
		}, []);
	}
}
