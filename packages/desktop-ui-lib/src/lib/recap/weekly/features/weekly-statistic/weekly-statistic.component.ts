import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { NbCardModule } from '@nebular/theme';
import { AsyncPipe, PercentPipe } from '@angular/common';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';
import { TranslatePipe } from '@ngx-translate/core';
import { PipesModule } from '../../../../../../../ui-core/shared/src/lib/pipes/pipes.module';

@Component({
    selector: 'ngx-weekly-statistic',
    templateUrl: './weekly-statistic.component.html',
    styleUrls: ['./weekly-statistic.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, AsyncPipe, PercentPipe, PipeModule, TranslatePipe, PipesModule]
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
