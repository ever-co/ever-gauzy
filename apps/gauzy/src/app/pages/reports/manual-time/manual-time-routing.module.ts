import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '../../../@theme/components/header/selectors/date-range-picker';
import { ManualTimeComponent } from './manual-time/manual-time.component';

const routes: Routes = [
	{
		path: '',
		component: ManualTimeComponent,
		data: {
			datePicker: {
				unitOfTime: 'week'
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
export class ManualTimeRoutingModule {}
