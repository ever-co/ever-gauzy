import { Injectable } from '@angular/core';
import { ITask, TaskStatusEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { TimeTrackerService } from 'packages/desktop-ui-lib/src/lib/time-tracker/time-tracker.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { ClientSelectorQuery } from '../../client-selector/+state/client-selector.query';
import { ProjectSelectorQuery } from '../../project-selector/+state/project-selector.query';
import { TaskSelectorQuery } from './task-selector.query';
import { TaskSelectorStore } from './task-selector.store';

@Injectable({
	providedIn: 'root'
})
export class TaskSelectorService {
	constructor(
		public readonly taskSelectorStore: TaskSelectorStore,
		public readonly taskSelectorQuery: TaskSelectorQuery,
		public readonly projectSelectorQuery: ProjectSelectorQuery,
		public readonly clientSelectorQuery: ClientSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly store: Store
	) {}

	public async addNewTask(title: ITask['title']): Promise<void> {
		if (!title) {
			return;
		}
		const { tenantId, organizationId, user } = this.store;
		const taskStatus = this.store.statuses.find((status) => status.isInProgress);
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
		} catch (error) {
			console.error('ERROR', error);
		}
	}
}
