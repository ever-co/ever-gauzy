import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { RecapQuery } from '../../+state/recap.query';
import { RecapStore } from '../../+state/recap.store';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-recap',
    templateUrl: './recap.component.html',
    styleUrls: ['./recap.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class RecapComponent {
	private readonly basePath = ['/', 'time-tracker', 'daily'];

	constructor(private readonly recapQuery: RecapQuery, private readonly recapStore: RecapStore) {}

	public get isLoading$(): Observable<boolean> {
		return this.recapQuery.isLoading$;
	}

	public onRangeChange(range: IDateRangePicker) {
		this.recapStore.update({ range });
	}

	public get segments() {
		return [
			{
				icon: 'chart-bar',
				title: 'TIMER_TRACKER.RECAP.HOURLY_TIME_TRACKING',
				path: [...this.basePath, 'hourly']
			},
			{
				icon: 'layer-group',
				title: 'TIMESHEET.PROJECTS',
				path: [...this.basePath, 'projects']
			},
			{
				icon: 'tasks',
				title: 'TIMESHEET.TASKS',
				path: [...this.basePath, 'tasks']
			},
			{
				icon: 'link',
				title: 'TIMESHEET.APPS_URLS',
				path: [...this.basePath, 'activities']
			}
		];
	}
}
