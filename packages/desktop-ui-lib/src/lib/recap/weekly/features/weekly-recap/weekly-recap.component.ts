import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { RequestQuery } from '../../../+state/request/request.query';
import { LoggerService } from '../../../../electron/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly-recap',
	templateUrl: './weekly-recap.component.html',
	styleUrls: ['./weekly-recap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
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
			await Promise.allSettled([this.weeklyRecapService.getCounts(), this.weeklyRecapService.getWeeklyActivities()]);
		} catch (error) {
			this.logger.error(error)
		}finally {
			this.isLoading$.next(false)
		}
	}
}
