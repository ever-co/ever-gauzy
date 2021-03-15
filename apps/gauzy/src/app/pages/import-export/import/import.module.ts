import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbRadioModule,
	NbToastrModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { ImportComponent } from './import.component';
import { ImportRoutingModule } from './import-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { ExportAllService } from '../../../@core/services/export-all.service';
import { FileUploaderModule } from '../../../@shared/file-uploader-input/file-uploader-input.module';
import { FileUploadModule } from 'ng2-file-upload';
import { TranslateModule } from '../../../@shared/translate/translate.module';

@NgModule({
	imports: [
		ImportRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		FileUploaderModule,
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		FileUploadModule,
		HttpClientModule,
		NbToastrModule.forRoot(),
		TranslateModule
	],
	declarations: [ImportComponent],
	exports: [ImportComponent],
	providers: [ExportAllService]
})
export class ImportModule {}
