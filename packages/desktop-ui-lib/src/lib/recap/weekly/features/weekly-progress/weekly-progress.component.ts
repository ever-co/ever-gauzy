import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, tap } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { updateWeekDays } from '../../../shared/features/date-range-picker';
import { ProgressStatusComponent } from '../../../shared/ui/progress-status/progress-status.component';

import { AsyncPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { NoDataMessageComponent } from '../../../../time-tracker/no-data-message/no-data-message.component';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';

@Component({
	selector: 'ngx-weekly-progress',
	templateUrl: './weekly-progress.component.html',
	styleUrls: ['./weekly-progress.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ProgressStatusComponent, NoDataMessageComponent, AsyncPipe, TranslatePipe, PipeModule]
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
