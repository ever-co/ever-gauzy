import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from './../../../../@theme/components/header/selectors/date-range-picker';
import { WeeklyComponent } from './weekly/weekly.component';

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
		resolve: {
			dates: DateRangePickerResolver
		},
		runGuardsAndResolvers: 'paramsOrQueryParamsChange'
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyRoutingModule {}
