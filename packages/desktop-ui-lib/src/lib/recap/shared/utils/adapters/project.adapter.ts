import { IProjectsStatistics } from '@gauzy/contracts';
import { IStatisticItem } from '../../ui/statistic/statistic.component';

export class ProjectStatisticsAdapter implements IStatisticItem {
	constructor(readonly projectStatistics: IProjectsStatistics) {}
	public get imageUrl(): string {
		return this.projectStatistics.imageUrl;
	}
	public get title(): string {
		return this.projectStatistics.name;
	}
	public get durationPercentage(): string {
		return (this.projectStatistics.durationPercentage || 0).toFixed(2);
	}
	public get duration(): number {
		return this.projectStatistics.duration;
	}
}
