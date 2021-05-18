import { NgModule } from '@angular/core';
import {
    ReactiveFormsModule
} from '@nebular/auth/node_modules/@angular/forms';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';
import { ProductTypeService } from 'apps/gauzy/src/app/@core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { SharedModule } from '../../../../@shared/shared.module';
import {
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbSpinnerModule,

} from '@nebular/theme';
import { CommonModule } from '@angular/common';
import { HeaderTitleModule } from 'apps/gauzy/src/app/@shared/components/header-title/header-title.module';
import { ThemeModule } from 'apps/gauzy/src/app/@theme';
import { ProductTypesComponent } from './product-types.component';
import { ProductTypesRoutingModule } from './product-types-routing.module';
import { CardGridModule } from 'apps/gauzy/src/app/@shared/card-grid/card-grid.module';


const NB_MODULES = [
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbSpinnerModule,
];


@NgModule({
    declarations: [ProductTypesComponent,],
    imports: [
        ProductTypesRoutingModule,
        ReactiveFormsModule,
        TranslateModule,
        Ng2SmartTableModule,
        CommonModule,
        TranslateModule,
        ...NB_MODULES,
        SharedModule,
        HeaderTitleModule,
        ThemeModule,
        CardGridModule
    ],
    providers: [ProductTypeService]
})
export class ProductTypesModule { }