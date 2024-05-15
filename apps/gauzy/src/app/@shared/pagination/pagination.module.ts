import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { PaginationComponent } from './pagination.component';

@NgModule({
	imports: [CommonModule, TranslateModule, NbIconModule, NbSelectModule],
	declarations: [PaginationComponent],
	exports: [PaginationComponent]
})
export class PaginationModule {}
