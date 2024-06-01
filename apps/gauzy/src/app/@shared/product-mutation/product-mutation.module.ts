import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import {
	ProductCategoryService,
	ProductService,
	ProductTypeService,
	ProductVariantPriceService,
	ProductVariantService,
	ProductVariantSettingService
} from '../../@core/services';
import { ProductTypeMutationComponent } from './product-type-mutation/product-type-mutation.component';
import { ProductCategoryMutationComponent } from './product-category-mutation/product-category-mutation.component';
import { ProductOptionGroupTranslationsComponent } from './product-option-group-translation/product-option-group-translation.component';
import { LanguageSelectorModule } from '../language/language-selector';
import { ImageUploaderModule } from '../image-uploader/image-uploader.module';

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
