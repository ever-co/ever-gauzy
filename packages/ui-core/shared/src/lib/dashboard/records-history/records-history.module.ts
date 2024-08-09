import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { AngularSmartTableModule } from '../../smart-table/smart-table.module';
import { RecordsHistoryComponent } from './records-history.component';

@NgModule({
	imports: [CommonModule, NbIconModule, NbSpinnerModule, NbCardModule, AngularSmartTableModule],
	exports: [RecordsHistoryComponent],
	declarations: [RecordsHistoryComponent]
})
export class RecordsHistoryModule {}
