import { NgModule } from '@angular/core';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '../../../../@shared/translate/translate.module';
import { MerchantService } from '../../../../@core';
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
    NbStepperModule
} from '@nebular/theme';
import { CommonModule } from '@angular/common';
import { HeaderTitleModule } from '../../../../@shared/components/header-title/header-title.module';
import { ThemeModule } from '../../../../@theme/theme.module';
import { MerchantRoutingModule } from './merchant-routing.module';
import { MerchantComponent } from './merchant.component';
import { LocationFormModule, LeafletMapModule } from '../../../../@shared/forms';
import { CurrencyModule } from '../../../../@shared/currency/currency.module';
import { PaginationModule } from '../../../../@shared/pagination/pagination.module';
import { TagsColorInputModule } from '../../../../@shared/tags/tags-color-input/tags-color-input.module';

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
    declarations: [
        MerchantComponent,
        MerchantTableComponent,
        MerchantFormComponent
    ],
    imports: [
        MerchantRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        Ng2SmartTableModule,
        CommonModule,
        TranslateModule,
        ...NB_MODULES,
        SharedModule,
        HeaderTitleModule,
        ThemeModule,
        CurrencyModule,
        LocationFormModule,
        LeafletMapModule,
        PaginationModule,
        TagsColorInputModule
    ],
    providers: [MerchantService]
})
export class MerchantModule { }