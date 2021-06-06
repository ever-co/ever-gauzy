import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectModule } from '../contact-select/contact-select.module';
import { ExpenseCategorySelectModule } from '../expenses/expense-category-select/expense-category-select.module';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';
import { TranslateModule } from '../translate/translate.module';
import { VendorSelectModule } from '../vendor-select/vendor-select.module';
import { ExpenseCategoryFilterComponent } from './expense-category-filter.component';
import { InputFilterComponent } from './input-filter.component';
import { OrganizationContactFilterComponent } from './organization-contact-filter.component';
import { PaymentMethodFilterComponent } from './payment-method-filter.component';
import { TagsColorFilterComponent } from './tags-color-filter.component';
import { VendorFilterComponent } from './vendor-filter.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgSelectModule,
		TranslateModule,
		TagsColorInputModule,
		VendorSelectModule,
		ExpenseCategorySelectModule,
		ContactSelectModule
	],
	declarations: [
		OrganizationContactFilterComponent,
		PaymentMethodFilterComponent,
		TagsColorFilterComponent,
		VendorFilterComponent,
		ExpenseCategoryFilterComponent,
		InputFilterComponent
	],
	exports: [],
	providers: []
})
export class TableFiltersModule {}
