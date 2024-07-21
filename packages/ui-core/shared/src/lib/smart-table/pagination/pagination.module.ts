import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { PaginationComponent } from './pagination.component';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), NbIconModule, NbSelectModule],
	declarations: [PaginationComponent],
	exports: [PaginationComponent]
})
export class PaginationModule {}
