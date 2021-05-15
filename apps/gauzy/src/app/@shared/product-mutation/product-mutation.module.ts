import { NgModule } from '@angular/core';
import { NgSelectModule } from '@ng-select/ng-select';
import {
	NbRadioModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbToastrModule
} from '@nebular/theme';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { ProductCategoryService } from '../../@core/services/product-category.service';
import { ProductService } from '../../@core/services/product.service';
import { ProductTypeService } from '../../@core/services/product-type.service';
import { ProductVariantService } from '../../@core/services/product-variant.service';
import { ProductVariantSettingsService } from '../../@core/services/product-variant-settings.service';
import { ProductVariantPriceService } from '../../@core/services/product-variant-price.service';
import { UserFormsModule } from '../user/forms/user-forms.module';
import { ProductTypeMutationComponent } from './product-type-mutation/product-type-mutation.component';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { ProductCategoryMutationComponent } from './product-category-mutation/product-category-mutation.component';
import { ImageUploaderModule } from '../image-uploader/image-uploader.module';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';
import { TranslateModule } from '../translate/translate.module';
import { ProductOptionGroupTranslationsComponent } from './product-option-group-translation/product-option-group-translation.component';
import { LanguageSelectorModule } from '../language/language-selector/language-selector.module';

@NgModule({
	declarations: [
		ProductTypeMutationComponent,
		ProductCategoryMutationComponent,
		ProductOptionGroupTranslationsComponent
	],
	imports: [
		TagsColorInputModule,
		ThemeModule,
		NgSelectModule,
		NbRadioModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		NbCheckboxModule,
		NbToastrModule,
		UserFormsModule,
		ImageUploaderModule,
		TranslateModule,
		LanguageSelectorModule,
	],
	providers: [
		ProductTypeService,
		ProductCategoryService,
		ProductService,
		ProductVariantService,
		ProductVariantSettingsService,
		ProductVariantPriceService,
		OrganizationsService
	]
})
export class ProductMutationModule {}
