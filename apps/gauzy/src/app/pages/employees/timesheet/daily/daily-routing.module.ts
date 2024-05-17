import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from './../../../../@theme/components/header/selectors/date-range-picker';
import { DailyComponent } from './daily/daily.component';

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
export class DailyRoutingModule {}
