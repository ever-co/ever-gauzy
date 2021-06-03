import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';
import { TranslateModule } from '../translate/translate.module';
import { VendorSelectModule } from '../vendor-select/vendor-select.module';
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
		VendorSelectModule
	],
	declarations: [
		OrganizationContactFilterComponent,
		PaymentMethodFilterComponent,
		TagsColorFilterComponent,
		VendorFilterComponent
	],
	exports: [],
	providers: []
})
export class TableFiltersModule {}
