import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, tap } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { updateWeekDays } from '../../../shared/features/date-range-picker';

@Component({
    selector: 'ngx-weekly-progress',
    templateUrl: './weekly-progress.component.html',
    styleUrls: ['./weekly-progress.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class WeeklyProgressComponent {
	public weekDays: string[] = [];

	constructor(private readonly weeklyRecapService: WeeklyRecapService) {}

	public get weeklyActivities$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.weeklyActivities[0]));
	}

	public get range$() {
		return this.weeklyRecapService.state$.pipe(
			tap((state) => {
				const { weekDays } = updateWeekDays(state.range);
				this.weekDays = weekDays;
			}),
			map((state) => state.range)
		);
	}
}
