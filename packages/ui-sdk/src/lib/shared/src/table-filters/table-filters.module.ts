import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbToggleModule } from '@nebular/theme';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
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

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgSelectModule,
		I18nTranslateModule.forChild(),
		TagsColorInputModule,
		VendorSelectModule,
		ExpenseCategorySelectModule,
		ContactSelectModule,
		TaskStatusSelectModule,
		NbToggleModule,
		FontAwesomeModule
	],
	declarations: [
		OrganizationContactFilterComponent,
		PaymentMethodFilterComponent,
		TagsColorFilterComponent,
		VendorFilterComponent,
		ExpenseCategoryFilterComponent,
		InputFilterComponent,
		OrganizationTeamFilterComponent,
		TaskStatusFilterComponent,
		ToggleFilterComponent
	],
	exports: [],
	providers: []
})
export class TableFiltersModule {}
