import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DateRangePickerResolver } from '../../@theme/components/header/selectors/date-range-picker';
import { ExpenseRecurringComponent } from './expense-recurring.component';

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
		resolve: {
			dates: DateRangePickerResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExpenseRecurringRoutingModule {}
