import { NgModule } from '@angular/core';
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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { PaginationModule } from '@gauzy/ui-sdk/shared';
import { ThemeModule } from '../../@theme/theme.module';
import { SharedModule } from '../../@shared/shared.module';
import { DocumentsComponent } from './documents.component';
import { DocumentsRoutingModule } from './documents-routing.module';
import { FileUploaderModule } from '../../@shared/file-uploader-input/file-uploader-input.module';
import { UploadDocumentComponent } from './upload-document/upload-document.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

const COMPONENTS = [DocumentsComponent, UploadDocumentComponent];

@NgModule({
	imports: [
		SharedModule,
		DocumentsRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbActionsModule,
		CardGridModule,
		TableComponentsModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		FileUploaderModule,
		NgSelectModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		PaginationModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [...COMPONENTS],
	providers: []
})
export class DocumentsModule {}
