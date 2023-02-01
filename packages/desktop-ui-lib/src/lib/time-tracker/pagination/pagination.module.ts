import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { PaginationComponent } from './pagination.component';
import { NbIconModule, NbSelectModule } from '@nebular/theme';

@NgModule({
	declarations: [PaginationComponent],
	imports: [CommonModule, Ng2SmartTableModule, NbIconModule, NbSelectModule],
	exports: [PaginationComponent]
})
export class PaginationModule {}
