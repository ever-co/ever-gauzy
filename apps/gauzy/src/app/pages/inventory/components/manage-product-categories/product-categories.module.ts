import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbInputModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { ProductCategoryService } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule, ProductMutationModule } from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ProductCategoriesComponent } from './product-categories.component';
import { ProductCategoriesRoutingModule } from './product-categories-routing.module';

@NgModule({
	declarations: [ProductCategoriesComponent],
	imports: [
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbInputModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		ProductCategoriesRoutingModule,
		ProductMutationModule,
		SmartDataViewLayoutModule
	],
	providers: [ProductCategoryService]
})
export class ProductCategoriesModule {}
