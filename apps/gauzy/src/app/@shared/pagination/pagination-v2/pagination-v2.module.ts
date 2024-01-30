import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { PaginationV2Component } from './pagination-v2.component';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [PaginationV2Component],
	imports: [
		CommonModule,
		Angular2SmartTableModule,
		NbIconModule,
		NbSelectModule,
		TranslateModule
	],
	exports: [PaginationV2Component],
})
export class PaginationV2Module { }
