import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ManualTimeComponent } from './manual-time/manual-time.component';
import { DateRangePickerResolver } from '../../../@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: ManualTimeComponent,
		data: {
			datePicker: {
				unitOfTime: 'week'
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ManualTimeRoutingModule {}
