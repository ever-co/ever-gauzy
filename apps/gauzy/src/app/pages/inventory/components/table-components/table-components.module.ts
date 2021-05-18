import { NgModule } from '@angular/core';
import { EnabledStatusComponent } from './enabled-row.component';
import { IconRowComponent } from './icon-row.component';
import { ImageRowComponent } from './image-row.component';
import { ItemImgTagsComponent } from './item-img-tags-row.component';
import { SelectedRowComponent } from './selected-row.component';
import { NbCheckboxModule } from '@nebular/theme';
 
@NgModule({
    declarations: [
        EnabledStatusComponent,
        IconRowComponent,
        ImageRowComponent,
        ItemImgTagsComponent,
        SelectedRowComponent
    ],
    imports: [
        NbCheckboxModule
    ]
})
export class TableComponentsModule { }