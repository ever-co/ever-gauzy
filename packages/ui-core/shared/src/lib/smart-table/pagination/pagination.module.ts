import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PaginationComponent } from './pagination.component';

@NgModule({
	imports: [CommonModule, TranslateModule.forChild(), NbIconModule, NbSelectModule],
	declarations: [PaginationComponent],
	exports: [PaginationComponent]
})
export class PaginationModule {}
