import { NgModule } from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule
} from '@nebular/auth/node_modules/@angular/forms';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';
import { ProductCategoryService } from 'apps/gauzy/src/app/@core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { SharedModule } from '../../../../@shared/shared.module';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule,
	NbSelectModule,
	NbTabsetModule,
	NbInputModule,
    NbStepperModule,
} from '@nebular/theme';
import { CommonModule } from '@angular/common';
import { HeaderTitleModule } from 'apps/gauzy/src/app/@shared/components/header-title/header-title.module';
import { ThemeModule } from 'apps/gauzy/src/app/@theme';
import { ProductCategoriesComponent } from './product-categories.component';
import { ProductCategoriesRoutingModule } from './product-categories-routing.module';
import { ProductCategoryMutationComponent } from 'apps/gauzy/src/app/@shared/product-mutation/product-category-mutation/product-category-mutation.component';


const NB_MODULES = [
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule,
	NbSelectModule,
	NbTabsetModule,
	NbInputModule,
	NbStepperModule
];


@NgModule({
    declarations: [ProductCategoriesComponent],
    imports: [
        ProductCategoriesRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        Ng2SmartTableModule,
        CommonModule,
        TranslateModule,
        ...NB_MODULES,
        SharedModule,
        HeaderTitleModule,
        ThemeModule
    ],
    entryComponents: [
		ProductCategoryMutationComponent,
    ],
    providers: [ProductCategoryService]
})
export class ProductCategoriesModule { }