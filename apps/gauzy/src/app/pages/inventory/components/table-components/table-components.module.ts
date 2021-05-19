import { NgModule } from '@angular/core';
import { EnabledStatusComponent } from './enabled-row.component';
import { IconRowComponent } from './icon-row.component';
import { ImageRowComponent } from './image-row.component';
import { ItemImgTagsComponent } from './item-img-tags-row.component';
import { SelectedRowComponent } from './selected-row.component';
import { NbCheckboxModule, NbBadgeModule } from '@nebular/theme';
import { CommonModule } from '@angular/common';
 
@NgModule({
    declarations: [
        EnabledStatusComponent,
        IconRowComponent,
        ImageRowComponent,
        ItemImgTagsComponent,
        SelectedRowComponent
    ],
    imports: [
        NbCheckboxModule,
        NbBadgeModule,
        CommonModule
    ]
})
export class TableComponentsModule { }