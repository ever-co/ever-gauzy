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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ExpensesMutationModule } from '../../@shared/expenses/expenses-mutation/expenses-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { SharedModule } from '../../@shared/shared.module';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService } from '../../@core/services';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { ExpenseCategoryMutationComponent } from './expense-categories/expense-category-mutation/expense-category-mutation.component';

@NgModule({
	imports: [
		NbBadgeModule,
		ExpensesRoutingModule,
		ThemeModule,
		SharedModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		ExpensesMutationModule,
		UserFormsModule,
		TableComponentsModule,
		CardGridModule,
		TranslateModule,
		NbSpinnerModule,
		NbActionsModule,
		TagsColorInputModule,
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		PaginationModule,
    	GauzyButtonActionModule
	],
	declarations: [
		ExpensesComponent,
		ExpenseCategoriesComponent,
		ExpenseCategoryMutationComponent
	],
	providers: [
		ExpenseCategoriesStoreService,
		OrganizationExpenseCategoriesService
	]
})
export class ExpensesModule {}
