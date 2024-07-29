import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, map } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
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
	private readonly recapQuery = inject(RecapQuery);
	private readonly requestQuery = inject(RequestQuery);
	private readonly service = inject(RecapService);

	ngOnInit(): void {
		combineLatest([this.recapQuery.range$, this.requestQuery.request$])
			.pipe(
				distinctUntilChange(),
				concatMap(() => this.service.getActivities()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get activities$(): Observable<IStatisticItem[]> {
		return this.recapQuery.state$.pipe(
			map((state) => state.activities.map((activity) => new ActivityStatisticsAdapter(activity)))
		);
	}
}
