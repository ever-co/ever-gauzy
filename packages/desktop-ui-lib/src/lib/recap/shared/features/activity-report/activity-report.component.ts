import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { IDailyActivity } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap, map, Observable } from 'rxjs';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { RecapQuery } from '../../../+state/recap.query';
import { RecapService } from '../../../+state/recap.service';
import { RequestQuery } from '../../../+state/request/request.query';
import { NbSpinnerModule, NbCardModule } from '@nebular/theme';
import { NgTemplateOutlet, AsyncPipe } from '@angular/common';

import { ProgressStatusComponent } from '../../ui/progress-status/progress-status.component';
import { ProjectColumnViewComponent } from '../../ui/project-column-view/project-column-view.component';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';
import { TranslatePipe } from '@ngx-translate/core';
import { PipesModule } from '../../../../../../../ui-core/shared/src/lib/pipes/pipes.module';
import { NoDataMessageComponent } from '../../../../time-tracker/no-data-message/no-data-message.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-activity-report',
    templateUrl: './activity-report.component.html',
    styleUrls: ['./activity-report.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbSpinnerModule, NbCardModule, NgTemplateOutlet, NoDataMessageComponent, ProgressStatusComponent, ProjectColumnViewComponent, AsyncPipe, PipeModule, TranslatePipe, PipesModule]
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
