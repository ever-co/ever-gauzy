import { NgModule } from '@angular/core';
import { DateViewComponent } from './date-view/date-view.component';
import { CommonModule } from '@angular/common';


@NgModule({
    imports: [
        CommonModule
    ],
    entryComponents: [
        DateViewComponent
    ],
    declarations: [DateViewComponent],
    providers: []
})
export class TableComponentsModule { }
