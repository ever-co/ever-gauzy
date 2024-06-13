import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService } from '@gauzy/ui-sdk/core';
import {
	CardGridModule,
	ExpensesMutationModule,
	GauzyButtonActionModule,
	NoDataMessageModule,
	PaginationV2Module,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	UserFormsModule
} from '@gauzy/ui-sdk/shared';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { ExpenseCategoryMutationComponent } from './expense-categories/expense-category-mutation/expense-category-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		Angular2SmartTableModule,
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
		I18nTranslateModule.forChild(),
		ExpensesRoutingModule,
		SharedModule,
		ExpensesMutationModule,
		UserFormsModule,
		TableComponentsModule,
		CardGridModule,
		TagsColorInputModule,
		PaginationV2Module,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [ExpensesComponent, ExpenseCategoriesComponent, ExpenseCategoryMutationComponent],
	providers: [ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService]
})
export class ExpensesModule {}
