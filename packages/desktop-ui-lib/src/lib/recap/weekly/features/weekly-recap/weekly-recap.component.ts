import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { RequestQuery } from '../../../+state/request/request.query';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly-recap',
	templateUrl: './weekly-recap.component.html',
	styleUrls: ['./weekly-recap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyRecapComponent implements OnInit {
	constructor(
		private readonly weeklyRecapService: WeeklyRecapService,
		private readonly requestQuery: RequestQuery,
		private readonly autoRefreshService: AutoRefreshService
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
		await Promise.allSettled([this.weeklyRecapService.getCounts(), this.weeklyRecapService.getWeeklyActivities()]);
	}
}
