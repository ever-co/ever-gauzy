import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, map, Observable } from 'rxjs';
import { RecapQuery } from '../../+state/recap.query';
import { RecapService } from '../../+state/recap.service';
import { RequestQuery } from '../../+state/request/request.query';
import { IStatisticItem } from '../../shared/ui/statistic/statistic.component';
import { ProjectStatisticsAdapter } from '../../shared/utils/adapters/project.adapter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-projects',
	templateUrl: './projects.component.html',
	styleUrls: ['./projects.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent implements OnInit {
	private readonly recapQuery = inject(RecapQuery);
	private readonly requestQuery = inject(RequestQuery);
	private readonly service = inject(RecapService);

	ngOnInit(): void {
		combineLatest([this.recapQuery.range$, this.requestQuery.request$])
			.pipe(
				distinctUntilChange(),
				concatMap(() => this.service.getProjects()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get projects$(): Observable<IStatisticItem[]> {
		return this.recapQuery.state$.pipe(
			map((state) => state.projects.map((project) => new ProjectStatisticsAdapter(project)))
		);
	}
}
