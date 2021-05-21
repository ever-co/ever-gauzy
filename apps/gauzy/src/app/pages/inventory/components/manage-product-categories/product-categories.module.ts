import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '../../../../@shared/translate/translate.module';
import { ProductCategoryService } from '../../../../@core/services/product-category.service';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { SharedModule } from '../../../../@shared/shared.module';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
} from '@nebular/theme';
import { CommonModule } from '@angular/common';
import { HeaderTitleModule } from '../../../../@shared/components/header-title/header-title.module';
import { ThemeModule } from '../../../../@theme/theme.module';
import { ProductCategoriesComponent } from './product-categories.component';
import { ProductCategoriesRoutingModule } from './product-categories-routing.module';
import { ProductMutationModule } from '../../../../@shared/product-mutation/product-mutation.module';


const NB_MODULES = [
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
];


@NgModule({
    declarations: [ProductCategoriesComponent],
    imports: [
        ProductCategoriesRoutingModule,
        ReactiveFormsModule,
        TranslateModule,
        Ng2SmartTableModule,
        CommonModule,
        TranslateModule,
        ...NB_MODULES,
        SharedModule,
        HeaderTitleModule,
        ThemeModule,
        ProductMutationModule
    ],
    providers: [ProductCategoryService]
})
export class ProductCategoriesModule { }