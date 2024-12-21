import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { IDailyActivity } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap, map, Observable } from 'rxjs';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { RecapQuery } from '../../../+state/recap.query';
import { RecapService } from '../../../+state/recap.service';
import { RequestQuery } from '../../../+state/request/request.query';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-activity-report',
    templateUrl: './activity-report.component.html',
    styleUrls: ['./activity-report.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ActivityReportComponent implements OnInit {
	public isLoading$ = new BehaviorSubject<boolean>(false);
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
	}

	public async load(): Promise<void> {
		await this.service.getDailyReport();
	}

	public get dailyActivities$(): Observable<IDailyActivity[]> {
		return this.recapQuery.state$.pipe(map((state) => state.dailyActivities));
	}
}
