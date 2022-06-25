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
    NbStepperModule,
    NbTooltipModule
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
import { GauzyButtonActionModule } from './../../../../@shared/gauzy-button-action/gauzy-button-action.module';
import { CardGridModule } from './../../../../@shared/card-grid/card-grid.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TableComponentsModule } from '../table-components';

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
	NbStepperModule,
    NbTooltipModule
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
        ...NB_MODULES,
        SharedModule,
        HeaderTitleModule,
        ThemeModule,
        CurrencyModule,
        LocationFormModule,
        LeafletMapModule,
        PaginationModule,
        TagsColorInputModule,
        GauzyButtonActionModule,
        CardGridModule,
        TableComponentsModule,
        NgxPermissionsModule.forChild()
    ],
    providers: [MerchantService]
})
export class MerchantModule { }