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
 
@NgModule({
    declarations: [
        EnabledStatusComponent,
        IconRowComponent,
        ImageRowComponent,
        ItemImgTagsComponent,
        SelectedRowComponent,
        ContactRowComponent
    ],
    imports: [
        NbCheckboxModule,
        NbBadgeModule,
        NbIconModule,
        CommonModule,
        TranslateModule
    ]
})
export class TableComponentsModule { }