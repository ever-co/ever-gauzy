import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CardGridModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	ProductMutationModule,
	TableComponentsModule
} from '@gauzy/ui-sdk/shared';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { ProductTypesComponent } from './product-types.component';
import { ProductTypesRoutingModule } from './product-types-routing.module';

@NgModule({
	declarations: [ProductTypesComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		Angular2SmartTableModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		ProductTypesRoutingModule,
		SharedModule,
		CardGridModule,
		ProductMutationModule,
		PaginationV2Module,
		GauzyButtonActionModule,
		TableComponentsModule
	]
})
export class ProductTypesModule {}
