import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BookmarkQueryParamsResolver } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
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
			dates: DateRangePickerResolver,
			bookmarkParams: BookmarkQueryParamsResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WeeklyRoutingModule {}
