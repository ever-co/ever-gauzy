import { NgModule } from '@angular/core';
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
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	FileUploaderModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { DocumentsComponent } from './documents.component';
import { DocumentsRoutingModule } from './documents-routing.module';
import { UploadDocumentComponent } from './upload-document/upload-document.component';

const COMPONENTS = [DocumentsComponent, UploadDocumentComponent];

@NgModule({
	imports: [
		DocumentsRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbActionsModule,
		SharedModule,
		CardGridModule,
		TableComponentsModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		FileUploaderModule,
		NgSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SmartDataViewLayoutModule
	],
	declarations: [...COMPONENTS],
	providers: []
})
export class DocumentsModule {}
