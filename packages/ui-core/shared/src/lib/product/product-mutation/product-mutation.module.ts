import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import {
	OrganizationsService,
	ProductCategoryService,
	ProductService,
	ProductTypeService,
	ProductVariantPriceService,
	ProductVariantService,
	ProductVariantSettingService
} from '@gauzy/ui-core/core';
import { LanguageSelectorModule } from '../../language/language-selector/language-selector.module';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { ProductTypeMutationComponent } from './product-type-mutation/product-type-mutation.component';
import { ProductCategoryMutationComponent } from './product-category-mutation/product-category-mutation.component';
import { ProductOptionGroupTranslationsComponent } from './product-option-group-translation/product-option-group-translation.component';

@NgModule({
	declarations: [
		ProductTypeMutationComponent,
		ProductCategoryMutationComponent,
		ProductOptionGroupTranslationsComponent
	],
	imports: [
		NbButtonModule,
		NbInputModule,
		NbCardModule,
		CommonModule,
		NbIconModule,
		TranslateModule.forChild(),
		LanguageSelectorModule,
		ImageUploaderModule,
		FormsModule,
		ReactiveFormsModule,
		NgSelectModule
	],
	providers: [
		ProductTypeService,
		ProductCategoryService,
		ProductService,
		ProductVariantService,
		ProductVariantSettingService,
		ProductVariantPriceService,
		OrganizationsService
	]
})
export class ProductMutationModule {}
