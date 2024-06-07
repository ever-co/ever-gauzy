import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbStepperModule,
	NbTabsetModule,
	NbTooltipModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CurrencyModule,
	GauzyButtonActionModule,
	LeafletMapModule,
	LocationFormModule,
	PaginationV2Module
} from '@gauzy/ui-sdk/shared';
import { MerchantComponent } from './merchant.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantRoutingModule } from './merchant-routing.module';
import { ThemeModule } from './../../../../@theme/theme.module';
import { CardGridModule } from './../../../../@shared/card-grid/card-grid.module';
import { HeaderTitleModule } from './../../../../@shared/components/header-title/header-title.module';
import { SharedModule } from './../../../../@shared/shared.module';
import { TagsColorInputModule } from './../../../../@shared/tags/tags-color-input/tags-color-input.module';
import { InventoryTableComponentsModule } from '../inventory-table-components';

const NB_MODULES = [
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule,
	NbSelectModule,
	NbTabsetModule,
	NbInputModule,
	NbStepperModule,
	NbTooltipModule
];

@NgModule({
	declarations: [MerchantComponent, MerchantFormComponent, MerchantTableComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		...NB_MODULES,
		Angular2SmartTableModule,
		NgxPermissionsModule.forChild(),
		MerchantRoutingModule,
		SharedModule,
		ThemeModule,
		I18nTranslateModule.forChild(),
		CardGridModule,
		CurrencyModule,
		GauzyButtonActionModule,
		HeaderTitleModule,
		InventoryTableComponentsModule,
		LeafletMapModule,
		LocationFormModule,
		PaginationV2Module,
		TagsColorInputModule
	],
	providers: []
})
export class MerchantModule {}
