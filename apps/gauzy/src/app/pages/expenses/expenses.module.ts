import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbBadgeModule,
	NbActionsModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ExpensesMutationModule } from '../../@shared/expenses/expenses-mutation/expenses-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { SharedModule } from '../../@shared/shared.module';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { ExpenseCategoriesStoreService } from '../../@core/services/expense-categories-store.service';
import { OrganizationExpenseCategoriesService } from '../../@core/services/organization-expense-categories.service';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		NbBadgeModule,
		ExpensesRoutingModule,
		ThemeModule,
		SharedModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		ExpensesMutationModule,
		UserFormsModule,
		TableComponentsModule,
		CardGridModule,
		TranslaterModule,
		NbSpinnerModule,
		NbActionsModule,
		TagsColorInputModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [ExpensesComponent, ExpenseCategoriesComponent],
	entryComponents: [],
	providers: [
		ExpenseCategoriesStoreService,
		OrganizationExpenseCategoriesService
	]
})
export class ExpensesModule {}
