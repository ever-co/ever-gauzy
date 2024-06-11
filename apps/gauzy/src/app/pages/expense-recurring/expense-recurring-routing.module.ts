import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ExpenseRecurringComponent } from './expense-recurring.component';
import { DateRangePickerResolver } from '../../@shared/selectors/date-range-picker';

const routes: Routes = [
	{
		path: '',
		component: ExpenseRecurringComponent,
		data: {
			selectors: {
				project: false,
				employee: false
			},
			datePicker: {
				unitOfTime: 'month'
			}
		},
		resolve: { dates: DateRangePickerResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpenseRecurringRoutingModule {}
