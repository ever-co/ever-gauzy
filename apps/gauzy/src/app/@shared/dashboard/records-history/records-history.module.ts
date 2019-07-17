import { NgModule } from '@angular/core';
import { RecordsHistoryComponent } from './records-history.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';

@NgModule({
    imports: [
        Ng2SmartTableModule
    ],
    exports: [RecordsHistoryComponent],
    declarations: [RecordsHistoryComponent],
    entryComponents: [RecordsHistoryComponent],
    providers: [
    ]
})
export class RecordsHistoryModule { }