import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReportDayData } from '@gauzy/contracts';
import { map, tap } from 'rxjs';
import { MonthlyRecapService } from '../../+state/monthly.service';
import { updateMonthWeeks, weekDateRange } from '../../../shared/features/date-range-picker';

export interface IMonthWeekdays {
	week: string;
	days: string[];
}

@Component({
    selector: 'ngx-monthly-progress',
    templateUrl: './monthly-progress.component.html',
    styleUrls: ['./monthly-progress.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class MonthlyProgressComponent {
	public monthWeekdays: IMonthWeekdays[] = [];

	constructor(private readonly monthlyRecapService: MonthlyRecapService) {}

	public get monthlyActivities$() {
		return this.monthlyRecapService.state$.pipe(map((state) => state.monthlyActivities[0]));
	}

	public get range$() {
		return this.monthlyRecapService.state$.pipe(
			tap((state) => {
				const { monthWeekdays } = updateMonthWeeks(state.range);
				this.monthWeekdays = monthWeekdays;
			}),
			map((state) => state.range)
		);
	}

	public sumPerWeek(month: IMonthWeekdays, data: ReportDayData): void {
		return month.days.reduce((acc, curr) => {
			const sum = data?.dates?.[curr]?.sum || 0;
			return acc + sum;
		}, 0);
	}

	public getWeekRange(number: number): string {
		return weekDateRange(number);
	}
}
