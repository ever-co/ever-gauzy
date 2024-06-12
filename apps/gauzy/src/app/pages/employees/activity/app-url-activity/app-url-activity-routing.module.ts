import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '@gauzy/ui-sdk/shared';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';

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
		}
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
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AppUrlActivityRoutingModule {}
