import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '../translate/translate.module';
import { PaginationComponent } from './pagination.component';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule,
		NbIconModule,
		NbSelectModule
	],
	declarations: [PaginationComponent],
	exports: [PaginationComponent]

})
export class PaginationModule { }
