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
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ProductCategoryService } from '@gauzy/ui-core/core';
import {
	CardGridModule,
	i4netButtonActionModule,
	PaginationV2Module,
	ProductMutationModule
} from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ProductCategoriesComponent } from './product-categories.component';
import { ProductCategoriesRoutingModule } from './product-categories-routing.module';

@NgModule({
	declarations: [ProductCategoriesComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbInputModule,
		NbTooltipModule,
		Angular2SmartTableModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		SharedModule,
		ProductCategoriesRoutingModule,
		ProductMutationModule,
		CardGridModule,
		PaginationV2Module,
		i4netButtonActionModule
	],
	providers: [ProductCategoryService]
})
export class ProductCategoriesModule { }
