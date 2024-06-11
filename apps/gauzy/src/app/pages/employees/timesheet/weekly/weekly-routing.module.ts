import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { WeeklyComponent } from './weekly/weekly.component';
import { DateRangePickerResolver } from 'apps/gauzy/src/app/@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: WeeklyComponent,
		data: {
			datePicker: {
				unitOfTime: 'week',
				isLockDatePicker: true
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyRoutingModule {}
