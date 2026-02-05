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
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
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

// Nebular Modules
const NB_MODULES = [
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
];

// Standalone Modules
const STANDALONE_MODULES = [
	InfiniteScrollDirective // Standalone directive must be imported, not declared
];

// Third Party Modules
const THIRD_PARTY_MODULES = [NgxPermissionsModule.forChild(), TranslateModule.forChild()];

@NgModule({
	imports: [
		...STANDALONE_MODULES,
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		ExpensesRoutingModule,
		SharedModule,
		ExpensesMutationModule,
		UserFormsModule,
		TableComponentsModule,
		CardGridModule,
		TagsColorInputModule,
		SmartDataViewLayoutModule
	],
	declarations: [ExpensesComponent, ExpenseCategoriesComponent, ExpenseCategoryMutationComponent],
	providers: [ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService]
})
export class ExpensesModule {}
