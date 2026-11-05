import { NgModule } from '@angular/core';
import {
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import { ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	ExpensesMutationModule,
	RecordViewModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	UserFormsModule,
	FavoriteToggleModule
} from '@gauzy/ui-core/shared';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { ExpenseCategoryMutationComponent } from './expense-categories/expense-category-mutation/expense-category-mutation.component';
import { ExpenseViewPageComponent } from './expense-view/expense-view-page.component';
import { ExpenseBarChartComponent } from './expense-view/expense-charts/expense-bar-chart.component';
import { ExpenseShareChartComponent } from './expense-view/expense-charts/expense-share-chart.component';

// Nebular Modules
const NB_MODULES = [
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
];

// Standalone Modules
const STANDALONE_MODULES = [
	InfiniteScrollDirective, // Standalone directive must be imported, not declared
	// The expense page's charts
	ExpenseBarChartComponent,
	ExpenseShareChartComponent
];

// Third Party Modules
const THIRD_PARTY_MODULES = [NgxPermissionsModule.forChild(), TranslatePipe];

@NgModule({
	imports: [
		FavoriteToggleModule,
		...STANDALONE_MODULES,
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		ExpensesRoutingModule,
		SharedModule,
		ExpensesMutationModule,
		RecordViewModule,
		UserFormsModule,
		TableComponentsModule,
		CardGridModule,
		TagsColorInputModule,
		SmartDataViewLayoutModule
	],
	declarations: [
		ExpensesComponent,
		ExpenseCategoriesComponent,
		ExpenseCategoryMutationComponent,
		ExpenseViewPageComponent
	],
	providers: [ExpenseCategoriesStoreService, OrganizationExpenseCategoriesService]
})
export class ExpensesModule {}
