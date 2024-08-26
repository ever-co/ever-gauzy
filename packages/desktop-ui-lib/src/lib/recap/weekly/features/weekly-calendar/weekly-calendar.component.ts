import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { IDateRangePicker } from '../../../shared/features/date-range-picker/date-picker.interface';

@Component({
	selector: 'ngx-weekly-calendar',
	templateUrl: './weekly-calendar.component.html',
	styleUrls: ['./weekly-calendar.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyCalendarComponent {
	constructor(private readonly weeklyRecapService: WeeklyRecapService) {}

	public get selectedDateRange$() {
		return this.weeklyRecapService.state$.pipe(map((state) => state.range));
	}

	public onRangeChange(range: IDateRangePicker) {
		this.weeklyRecapService.update({ range });
	}
}
