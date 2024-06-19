import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { PaginationComponent } from './pagination.component';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), NbIconModule, NbSelectModule],
	declarations: [PaginationComponent],
	exports: [PaginationComponent]
})
export class PaginationModule {}
