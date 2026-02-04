import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs';
import { WeeklyRecapService } from '../../+state/weekly.service';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';
import { IDateRangePicker } from '../../../shared/features/date-range-picker/date-picker.interface';
import { DateRangePickerComponent } from '../../../shared/features/date-range-picker/date-range-picker.component';

@Component({
	selector: 'ngx-weekly-calendar',
	templateUrl: './weekly-calendar.component.html',
	styleUrls: ['./weekly-calendar.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DateRangePickerComponent, AsyncPipe, PipeModule]
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
