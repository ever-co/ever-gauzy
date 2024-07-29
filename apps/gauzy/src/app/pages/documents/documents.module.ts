import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule,
	NbSelectModule,
	NbActionsModule,
	NbSpinnerModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import {
	CardGridModule,
	FileUploaderModule,
	GauzyButtonActionModule,
	NoDataMessageModule,
	PaginationModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { DocumentsComponent } from './documents.component';
import { DocumentsRoutingModule } from './documents-routing.module';
import { UploadDocumentComponent } from './upload-document/upload-document.component';

const COMPONENTS = [DocumentsComponent, UploadDocumentComponent];

@NgModule({
	imports: [
		CommonModule,
		DocumentsRoutingModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbActionsModule,
		SharedModule,
		CardGridModule,
		TableComponentsModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		FileUploaderModule,
		NgSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		PaginationModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [...COMPONENTS],
	providers: []
})
export class DocumentsModule {}
