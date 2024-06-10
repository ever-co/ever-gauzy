import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { PaginationComponent } from './pagination.component';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), NbIconModule, NbSelectModule],
	declarations: [PaginationComponent],
	exports: [PaginationComponent]
})
export class PaginationModule {}
