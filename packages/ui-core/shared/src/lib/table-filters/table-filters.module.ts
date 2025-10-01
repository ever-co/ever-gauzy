import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbDatepickerModule, NbToggleModule } from '@nebular/theme';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { ExpenseCategorySelectModule } from '../expenses/expense-category-select/expense-category-select.module';
import { VendorSelectModule } from '../vendor-select/vendor-select.module';
import { ExpenseCategoryFilterComponent } from './expense-category-filter.component';
import { InputFilterComponent } from './input-filter.component';
import { OrganizationContactFilterComponent } from './organization-contact-filter.component';
import { PaymentMethodFilterComponent } from './payment-method-filter.component';
import { TagsColorFilterComponent } from './tags-color-filter.component';
import { OrganizationTeamFilterComponent } from './organization-team-filter.component';
import { VendorFilterComponent } from './vendor-filter.component';
import { TaskStatusFilterComponent } from './task-status-filter.component';
import { ToggleFilterComponent } from './toggle-filter/toggle-filter.component';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';
import { ContactSelectModule } from '../contact-select/contact-select.module';
import { TaskStatusSelectModule } from '../tasks/task-status-select/task-status-select.module';
import { DateFilterComponent } from './date-filter.component';
import { RangeFilterComponent } from './range-filter.component';
import { ProductCategorySelectorModule, ProductTypeSelectorModule } from '../product';
import { ProductCategoryFilterComponent } from './product-category-filter.component';
import { ProductTypeFilterComponent } from './product-type-filter.component';
import { EmploymentTypeFilterComponent } from './employment-type-filter.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgSelectModule,
		TranslateModule.forChild(),
		TagsColorInputModule,
		VendorSelectModule,
		ExpenseCategorySelectModule,
		ProductCategorySelectorModule,
		ProductTypeSelectorModule,
		ContactSelectModule,
		TaskStatusSelectModule,
		NbToggleModule,
		FontAwesomeModule,
		NbDatepickerModule
	],
	declarations: [
		OrganizationContactFilterComponent,
		PaymentMethodFilterComponent,
		TagsColorFilterComponent,
		VendorFilterComponent,
		ExpenseCategoryFilterComponent,
		ProductCategoryFilterComponent,
		ProductTypeFilterComponent,
		InputFilterComponent,
		RangeFilterComponent,
		OrganizationTeamFilterComponent,
		TaskStatusFilterComponent,
		ToggleFilterComponent,
		DateFilterComponent,
		EmploymentTypeFilterComponent
	],
	exports: [],
	providers: []
})
export class TableFiltersModule {}
