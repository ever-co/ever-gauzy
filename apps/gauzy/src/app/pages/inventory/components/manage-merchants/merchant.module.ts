import { NgModule } from '@angular/core';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';
import {
    FormsModule,
    ReactiveFormsModule
} from '@nebular/auth/node_modules/@angular/forms';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';
import { MerchantService } from 'apps/gauzy/src/app/@core';
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
import { HeaderTitleModule } from 'apps/gauzy/src/app/@shared/components/header-title/header-title.module';
import { ThemeModule } from 'apps/gauzy/src/app/@theme';
import { MerchantRoutingModule } from './merchant-routing.module';
import { MerchantComponent } from './merchant.component';
import { LocationFormModule, LeafletMapModule } from 'apps/gauzy/src/app/@shared/forms';
import { CurrencyModule } from 'apps/gauzy/src/app/@shared';

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
        MerchantFormComponent],
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
		LeafletMapModule
    ],
    providers: [MerchantService]
})
export class MerchantModule { }