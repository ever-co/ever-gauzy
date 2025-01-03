import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';

@Component({
    selector: 'ngx-weekly-statistic',
    templateUrl: './weekly-statistic.component.html',
    styleUrls: ['./weekly-statistic.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class WeeklyStatisticComponent {
	constructor(private readonly weeklyRecapService: WeeklyRecapService) {}

	public get todayDuration$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.count.todayDuration));
	}

	public get weeklyDuration$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.count.weekDuration));
	}

	public get todayActivity$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.count.todayActivities / 100));
	}

	public get weeklyActivity$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.count.weekActivities / 100));
	}

	public get weeklyLimit$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.count.reWeeklyLimit));
	}
}
