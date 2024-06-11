import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DailyComponent } from './daily/daily.component';
import { DateRangePickerResolver } from 'apps/gauzy/src/app/@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: DailyComponent,
		data: {
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSingleDatePicker: true
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DailyRoutingModule {}
