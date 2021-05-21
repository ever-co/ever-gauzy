import { NgModule } from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule
} from '@nebular/auth/node_modules/@angular/forms';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';
import { WarehouseService } from 'apps/gauzy/src/app/@core';
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
} from '@nebular/theme';
import { CommonModule } from '@angular/common';
import { HeaderTitleModule } from 'apps/gauzy/src/app/@shared/components/header-title/header-title.module';
import { ThemeModule } from 'apps/gauzy/src/app/@theme';
import { ProductTypeMutationComponent } from '../../../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { WarehousesTableComponent } from './warehouses-table/warehouses-table.component';
import { WarehouseFormComponent } from './warehouse-form/warehouse-form.component';
import { WarehousesComponent } from './warehouses.component';
import { WarehouseProductsTableComponent } from './warehouse-products-table/warehouse-products-table.component';
import { WarehousesRoutingModule } from './warehouses-routing.module';
import { SelectProductComponent } from './select-product-form/select-product-form.component';
import { ManageQuantityComponent } from './manage-quantity/manage-quantity.component';
import { ManageVariantsQuantityComponent } from './manage-variants-quantity/manage-variants-quantity.component';
import { ManageVariantsQuantityFormComponent } from './manage-variants-quantity-form/manage-variants-quantity-form.component';
import { LeafletMapModule, LocationFormModule } from 'apps/gauzy/src/app/@shared/forms';
import { TagsColorInputModule } from 'apps/gauzy/src/app/@shared/tags/tags-color-input/tags-color-input.module';


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
];


@NgModule({
    declarations: [
        WarehousesTableComponent,
        WarehouseFormComponent,
        WarehousesComponent,
        WarehouseProductsTableComponent,
        SelectProductComponent,
        ManageQuantityComponent,
        ManageVariantsQuantityComponent,
        ManageVariantsQuantityFormComponent,
    ],
    imports: [
        WarehousesRoutingModule,
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
        LocationFormModule,
        LeafletMapModule,
        TagsColorInputModule
    ],
    entryComponents: [
        ProductTypeMutationComponent,
    ],
    providers: [WarehouseService]
})
export class WarehousesModule { }