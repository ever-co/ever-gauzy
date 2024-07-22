import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { PaginationV2Component } from './pagination-v2.component';

@NgModule({
	declarations: [PaginationV2Component],
	imports: [CommonModule, Angular2SmartTableModule, NbIconModule, NbSelectModule, I18nTranslateModule.forChild()],
	exports: [PaginationV2Component]
})
export class PaginationV2Module {}
