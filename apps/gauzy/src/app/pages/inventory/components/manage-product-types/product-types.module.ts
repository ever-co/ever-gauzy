import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../../../@shared/shared.module';
import { ProductTypesComponent } from './product-types.component';
import { ProductTypesRoutingModule } from './product-types-routing.module';
import { CardGridModule } from './../../../../@shared/card-grid/card-grid.module';
import { ProductMutationModule } from './../../../../@shared/product-mutation/product-mutation.module';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';

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
