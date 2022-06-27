import { NgModule } from '@angular/core';
import { EnabledStatusComponent } from './enabled-row.component';
import { IconRowComponent } from './icon-row.component';
import { ImageRowComponent } from './image-row.component';
import { ItemImgTagsComponent } from './item-img-tags-row.component';
import { SelectedRowComponent } from './selected-row.component';
import { NbCheckboxModule, NbBadgeModule, NbIconModule } from '@nebular/theme';
import { CommonModule } from '@angular/common';
import { ContactRowComponent } from './contact-row.component';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';
import { NameWithDescriptionComponent } from './name-with-description/name-with-description.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NoImageComponent } from './no-image/no-image.component';
 
@NgModule({
    declarations: [
        EnabledStatusComponent,
        IconRowComponent,
        ImageRowComponent,
        ItemImgTagsComponent,
        SelectedRowComponent,
        ContactRowComponent,
        NameWithDescriptionComponent,
        NoImageComponent
    ],
    imports: [
        NbCheckboxModule,
        NbBadgeModule,
        NbIconModule,
        CommonModule,
        TranslateModule,
        SharedModule
    ],
    exports: [ NoImageComponent ]
})
export class InventoryTableComponentsModule { }