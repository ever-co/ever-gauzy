import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '../translate/translate.module';
import { PaginationComponent } from './pagination.component';
import { NbIconModule } from '@nebular/theme';

@NgModule({
	declarations: [PaginationComponent],
	imports: [
		CommonModule,
		TranslateModule,
    NbIconModule
	],
	exports: [PaginationComponent]

})
export class PaginationModule {}
