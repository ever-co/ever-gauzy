import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '../translate/translate.module';
import { PaginationComponent } from './pagination.component';

@NgModule({
	declarations: [PaginationComponent],
	imports: [
		CommonModule,
		// NbButtonModule,
		// NbDialogModule,
		// NbIconModule,
		// SharedModule,
		TranslateModule
	],
	exports: [PaginationComponent]
	
})
export class PaginationModule {}
