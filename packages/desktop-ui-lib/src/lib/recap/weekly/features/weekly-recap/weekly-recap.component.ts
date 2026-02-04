import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { RequestQuery } from '../../../+state/request/request.query';
import { LoggerService } from '../../../../electron/services';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';
import { FilterComponent } from '../../../features/filter/filter.component';
import { WeeklyCalendarComponent } from '../weekly-calendar/weekly-calendar.component';
import { WeeklyProgressComponent } from '../weekly-progress/weekly-progress.component';
import { WeeklyStatisticComponent } from '../weekly-statistic/weekly-statistic.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly-recap',
	templateUrl: './weekly-recap.component.html',
	styleUrls: ['./weekly-recap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbCardModule,
		NbIconModule,
		WeeklyCalendarComponent,
		FilterComponent,
		WeeklyStatisticComponent,
		WeeklyProgressComponent,
		AsyncPipe,
		PipeModule
	]
})
export class WeeklyRecapComponent implements OnInit {
	public isLoading$ = new BehaviorSubject(false);
	constructor(
		private readonly weeklyRecapService: WeeklyRecapService,
		private readonly requestQuery: RequestQuery,
		private readonly autoRefreshService: AutoRefreshService,
		private readonly logger: LoggerService
	) {}

	ngOnInit(): void {
		combineLatest([this.weeklyRecapService.range$, this.requestQuery.request$, this.autoRefreshService.refresh$])
			.pipe(
				concatMap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public async load(): Promise<void> {
		try {
			this.isLoading$.next(true);
			await Promise.allSettled([
				this.weeklyRecapService.getCounts(),
				this.weeklyRecapService.getWeeklyActivities()
			]);
		} catch (error) {
			this.logger.error(error);
		} finally {
			this.isLoading$.next(false);
		}
	}
}
