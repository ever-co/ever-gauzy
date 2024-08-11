import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
import { RecordsHistoryComponent } from './records-history.component';

@NgModule({
	imports: [CommonModule, NbIconModule, NbSpinnerModule, NbCardModule, SmartDataViewLayoutModule],
	exports: [RecordsHistoryComponent],
	declarations: [RecordsHistoryComponent]
})
export class RecordsHistoryModule {}
