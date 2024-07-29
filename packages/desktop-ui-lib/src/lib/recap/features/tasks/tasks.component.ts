import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, map, Observable } from 'rxjs';
import { RecapQuery } from '../../+state/recap.query';
import { RecapService } from '../../+state/recap.service';
import { RequestQuery } from '../../+state/request/request.query';
import { IStatisticItem } from '../../shared/ui/statistic/statistic.component';
import { TaskStatisticsAdapter } from '../../shared/utils/adapters/task.adapter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-tasks',
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TasksComponent implements OnInit {
	private readonly recapQuery = inject(RecapQuery);
	private readonly requestQuery = inject(RequestQuery);
	private readonly service = inject(RecapService);

	ngOnInit(): void {
		combineLatest([this.recapQuery.range$, this.requestQuery.request$])
			.pipe(
				distinctUntilChange(),
				concatMap(() => this.service.getTasks()),
				untilDestroyed(this)
			)
			.subscribe();
	}
	public get tasks$(): Observable<IStatisticItem[]> {
		return this.recapQuery.state$.pipe(map((state) => state.tasks.map((task) => new TaskStatisticsAdapter(task))));
	}
}
