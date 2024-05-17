import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';
import { DateRangePickerResolver } from '../../../../@theme/components/header/selectors/date-range-picker';

const routes: Routes = [
	{
		path: 'apps',
		component: AppUrlActivityComponent,
		data: {
			title: 'ACTIVITY.APPS',
			type: 'apps',
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSaveDatePicker: true,
				isSingleDatePicker: true,
				isDisableFutureDate: true
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		},
		runGuardsAndResolvers: 'paramsOrQueryParamsChange'
	},
	{
		path: 'urls',
		component: AppUrlActivityComponent,
		data: {
			title: 'ACTIVITY.VISITED_SITES',
			type: 'urls',
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSaveDatePicker: true,
				isSingleDatePicker: true,
				isDisableFutureDate: true
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
export class AppUrlActivityRoutingModule {}
