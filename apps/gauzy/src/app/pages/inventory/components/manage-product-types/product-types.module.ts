import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ProductTypeService } from '@gauzy/ui-sdk/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { SharedModule } from '../../../../@shared/shared.module';
import { HeaderTitleModule } from './../../../../@shared/components/header-title/header-title.module';
import { ThemeModule } from './../../../../@theme/theme.module';
import { ProductTypesComponent } from './product-types.component';
import { ProductTypesRoutingModule } from './product-types-routing.module';
import { CardGridModule } from './../../../../@shared/card-grid/card-grid.module';
import { ProductMutationModule } from './../../../../@shared/product-mutation/product-mutation.module';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { GauzyButtonActionModule } from './../../../../@shared/gauzy-button-action/gauzy-button-action.module';
import { TableComponentsModule } from './../../../../@shared/table-components/table-components.module';

const NB_MODULES = [NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule];

@NgModule({
	declarations: [ProductTypesComponent],
	imports: [
		ProductTypesRoutingModule,
		ReactiveFormsModule,
		Angular2SmartTableModule,
		CommonModule,
		I18nTranslateModule.forChild(),
		...NB_MODULES,
		SharedModule,
		HeaderTitleModule,
		ThemeModule,
		CardGridModule,
		ProductMutationModule,
		PaginationV2Module,
		GauzyButtonActionModule,
		TableComponentsModule
	],
	providers: [ProductTypeService]
})
export class ProductTypesModule {}
