import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, from, map, Observable, Subject } from 'rxjs';
import { AutoRefreshService } from '../../+state/auto-refresh/auto-refresh.service';
import { RecapQuery } from '../../+state/recap.query';
import { RecapService } from '../../+state/recap.service';
import { RequestQuery } from '../../+state/request/request.query';
import { IStatisticItem } from '../../shared/ui/statistic/statistic.component';
import { ActivityStatisticsAdapter } from '../../shared/utils/adapters/activity.adapter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activities',
	templateUrl: './activities.component.html',
	styleUrls: ['./activities.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesComponent implements OnInit {
	private readonly _subject$: Subject<void> = new Subject();
	constructor(
		private readonly recapQuery: RecapQuery,
		private readonly requestQuery: RequestQuery,
		private readonly service: RecapService,
		private readonly autoRefreshService: AutoRefreshService
	) {}

	ngOnInit(): void {
		combineLatest([this.recapQuery.range$, this.requestQuery.request$, this.autoRefreshService.refresh$])
			.pipe(
				concatMap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
		from(this.load()).pipe(untilDestroyed(this)).subscribe();
	}

	public async load(): Promise<void> {
		await this.service.getActivities();
	}

	public get activities$(): Observable<IStatisticItem[]> {
		return this.recapQuery.state$.pipe(
			map((state) => state.activities.map((activity) => new ActivityStatisticsAdapter(activity)))
		);
	}
}
