import { ITasksStatistics } from '@gauzy/contracts';
import { IStatisticItem } from '../../ui/statistic/statistic.component';

export class TaskStatisticsAdapter implements IStatisticItem {
	constructor(readonly taskStatistics: ITasksStatistics) {}
	public get imageUrl(): string {
		return null;
	}
	public get title(): string {
		return this.taskStatistics.title;
	}
	public get durationPercentage(): string {
		return this.taskStatistics.durationPercentage.toFixed(2);
	}
	public get duration(): number {
		return this.taskStatistics.duration;
	}
}
