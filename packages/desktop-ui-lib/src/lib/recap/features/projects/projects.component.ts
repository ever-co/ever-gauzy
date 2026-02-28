import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, map, Observable } from 'rxjs';
import { AutoRefreshService } from '../../+state/auto-refresh/auto-refresh.service';
import { RecapQuery } from '../../+state/recap.query';
import { RecapService } from '../../+state/recap.service';
import { RequestQuery } from '../../+state/request/request.query';
import { IStatisticItem, StatisticComponent } from '../../shared/ui/statistic/statistic.component';
import { ProjectStatisticsAdapter } from '../../shared/utils/adapters/project.adapter';
import { NbCardModule } from '@nebular/theme';

import { AsyncPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { NoDataMessageComponent } from '../../../time-tracker/no-data-message/no-data-message.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, StatisticComponent, NoDataMessageComponent, AsyncPipe, TranslatePipe]
})
export class ProjectsComponent implements OnInit {
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
		await this.service.getProjects();
	}

	public get projects$(): Observable<IStatisticItem[]> {
		return this.recapQuery.state$.pipe(
			map((state) => state.projects.map((project) => new ProjectStatisticsAdapter(project)))
		);
	}
}
