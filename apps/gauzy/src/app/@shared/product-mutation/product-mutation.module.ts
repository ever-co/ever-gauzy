import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbInputModule
} from '@nebular/theme';
import { ProductCategoryService } from '../../@core/services/product-category.service';
import { ProductService } from '../../@core/services/product.service';
import { ProductTypeService } from '../../@core/services/product-type.service';
import { ProductVariantService } from '../../@core/services/product-variant.service';
import { ProductVariantSettingsService } from '../../@core/services/product-variant-settings.service';
import { ProductVariantPriceService } from '../../@core/services/product-variant-price.service';
import { ProductTypeMutationComponent } from './product-type-mutation/product-type-mutation.component';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { ProductCategoryMutationComponent } from './product-category-mutation/product-category-mutation.component';
import { TranslateModule } from '../translate/translate.module';
import { ProductOptionGroupTranslationsComponent } from './product-option-group-translation/product-option-group-translation.component';
import { LanguageSelectorModule } from '../language/language-selector';
import { CommonModule } from '@angular/common';

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
		TranslateModule,
		LanguageSelectorModule
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
