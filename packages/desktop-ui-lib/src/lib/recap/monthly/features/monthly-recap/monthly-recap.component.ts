import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap } from 'rxjs';
import { MonthlyRecapService } from '../../+state/monthly.service';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { RequestQuery } from '../../../+state/request/request.query';
import { LoggerService } from '../../../../electron/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-monthly-recap',
	templateUrl: './monthly-recap.component.html',
	styleUrls: ['./monthly-recap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyRecapComponent implements OnInit {
	public isLoading$ = new BehaviorSubject(false);
	constructor(
		private readonly monthlyRecapService: MonthlyRecapService,
		private readonly requestQuery: RequestQuery,
		private readonly autoRefreshService: AutoRefreshService,
		private readonly logger: LoggerService
	) {}

	ngOnInit(): void {
		combineLatest([this.monthlyRecapService.range$, this.requestQuery.request$, this.autoRefreshService.refresh$])
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
				this.monthlyRecapService.getCounts(),
				this.monthlyRecapService.getMonthActivities()
			]);
		} catch (error) {
			this.logger.error(error);
		} finally {
			this.isLoading$.next(false);
		}
	}
}
