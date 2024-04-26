import { IDailyPlan } from 'daily-plan.model';
import { ITask } from 'task.model';

export interface IDailyPlanTask {
	dailyPlan: IDailyPlan;
	dailyPlanId: IDailyPlan['id'];
	task: ITask;
	taskId: ITask['id'];
}
