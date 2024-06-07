import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbInputModule,
	NbTooltipModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ProductCategoryService } from '@gauzy/ui-sdk/core';
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../../../@shared/shared.module';
import { HeaderTitleModule } from '../../../../@shared/components/header-title/header-title.module';
import { ThemeModule } from '../../../../@theme/theme.module';
import { ProductCategoriesComponent } from './product-categories.component';
import { ProductCategoriesRoutingModule } from './product-categories-routing.module';
import { ProductMutationModule } from '../../../../@shared/product-mutation/product-mutation.module';
import { CardGridModule } from '../../../../@shared/card-grid/card-grid.module';

const NB_MODULES = [NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbInputModule, NbTooltipModule];

@NgModule({
	declarations: [ProductCategoriesComponent],
	imports: [
		ProductCategoriesRoutingModule,
		ReactiveFormsModule,
		FormsModule,
		I18nTranslateModule.forChild(),
		Angular2SmartTableModule,
		CommonModule,
		I18nTranslateModule.forChild(),
		...NB_MODULES,
		SharedModule,
		HeaderTitleModule,
		ThemeModule,
		ProductMutationModule,
		CardGridModule,
		PaginationV2Module,
		GauzyButtonActionModule
	],
	providers: [ProductCategoryService]
})
export class ProductCategoriesModule {}
