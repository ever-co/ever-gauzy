import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { MonthlyRecapService } from '../../+state/monthly.service';
import { NbCardModule } from '@nebular/theme';
import { AsyncPipe, PercentPipe } from '@angular/common';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';
import { TranslatePipe } from '@ngx-translate/core';
import { PipesModule } from '../../../../../../../ui-core/shared/src/lib/pipes/pipes.module';

@Component({
    selector: 'ngx-monthly-statistic',
    templateUrl: './monthly-statistic.component.html',
    styleUrls: ['./monthly-statistic.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, AsyncPipe, PercentPipe, PipeModule, TranslatePipe, PipesModule]
})
export class MonthlyStatisticComponent {
	constructor(private readonly monthlyRecapService: MonthlyRecapService) {}

	public get todayDuration$() {
		return this.monthlyRecapService.state$.pipe(map((state) => state.count.todayDuration));
	}

	public get monthlyDuration$() {
		return this.monthlyRecapService.state$.pipe(map((state) => state.count.weekDuration));
	}

	public get todayActivity$() {
		return this.monthlyRecapService.state$.pipe(map((state) => state.count.todayActivities / 100));
	}

	public get monthlyActivity$() {
		return this.monthlyRecapService.state$.pipe(map((state) => state.count.weekActivities / 100));
	}
}
