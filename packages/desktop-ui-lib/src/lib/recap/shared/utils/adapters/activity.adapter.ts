import { IActivitiesStatistics } from '@gauzy/contracts';
import { IStatisticItem } from '../../ui/statistic/statistic.component';

export class ActivityStatisticsAdapter implements IStatisticItem {
	constructor(readonly activitiesStatistics: IActivitiesStatistics) {}
	public get imageUrl(): string {
		return null;
	}
	public get title(): string {
		return this.activitiesStatistics.title;
	}
	public get durationPercentage(): string {
		return (this.activitiesStatistics.durationPercentage || 0).toFixed(2);
	}
	public get duration(): number {
		return this.activitiesStatistics.duration;
	}
}
