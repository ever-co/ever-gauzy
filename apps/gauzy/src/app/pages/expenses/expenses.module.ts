import { NgModule } from '@angular/core';
import {
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	ExpensesMutationModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { ExpenseCategoryMutationComponent } from './expense-categories/expense-category-mutation/expense-category-mutation.component';

@NgModule({
	imports: [
		InfiniteScrollModule,
		NbActionsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		ExpensesRoutingModule,
		SharedModule,
		ExpensesMutationModule,
		UserFormsModule,
		TableComponentsModule,
		TagsColorInputModule,
		SmartDataViewLayoutModule
	],
	declarations: [ExpensesComponent, ExpenseCategoriesComponent, ExpenseCategoryMutationComponent],
	providers: [ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService]
})
export class ExpensesModule {}
