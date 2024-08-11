import { NgModule } from '@angular/core';
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
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	CurrencyModule,
	LeafletMapModule,
	LocationFormModule,
	SharedModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { MerchantComponent } from './merchant.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantRoutingModule } from './merchant-routing.module';
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
		...NB_MODULES,
		NgxPermissionsModule.forChild(),
		MerchantRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		SmartDataViewLayoutModule,
		CardGridModule,
		CurrencyModule,
		InventoryTableComponentsModule,
		LeafletMapModule,
		LocationFormModule,
		TagsColorInputModule
	],
	providers: []
})
export class MerchantModule {}
