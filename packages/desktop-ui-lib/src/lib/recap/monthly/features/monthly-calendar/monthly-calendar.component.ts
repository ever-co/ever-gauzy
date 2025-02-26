import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { MonthlyRecapService } from '../../+state/monthly.service';
import { IDateRangePicker } from '../../../shared/features/date-range-picker/date-picker.interface';

@Component({
    selector: 'ngx-monthly-calendar',
    templateUrl: './monthly-calendar.component.html',
    styleUrls: ['./monthly-calendar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class MonthlyCalendarComponent {
	constructor(private readonly monthlyRecapService: MonthlyRecapService) {}

	public get selectedDateRange$() {
		return this.monthlyRecapService.state$.pipe(map((state) => state.range));
	}

	public onRangeChange(range: IDateRangePicker) {
		this.monthlyRecapService.update({ range });
	}
}
