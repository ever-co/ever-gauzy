import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbRadioModule,
	NbToastrModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ImportComponent } from './import.component';
import { FileUploadModule } from 'ng2-file-upload';
import { ThemeModule } from '../../../@theme/theme.module';
import { ImportRoutingModule } from './import-routing.module';
import { ExportAllService } from '../../../@core/services/export-all.service';
import { FileUploaderModule } from '../../../@shared/file-uploader-input/file-uploader-input.module';
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
		TranslateModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [ImportComponent],
	exports: [ImportComponent],
	providers: [ExportAllService]
})
export class ImportModule {}
