import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbRadioModule,
	NbCheckboxModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ExportComponent } from './export.component';
import { ExportRoutingModule } from './export-routing.module';
import { ExportAllService } from '../../../@core/services/export-all.service';
import { FileUploaderModule } from '../../../@shared/file-uploader-input/file-uploader-input.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../../@shared/shared.module';

@NgModule({
	imports: [
		ExportRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		FileUploaderModule,
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbCheckboxModule,
		NbSpinnerModule,
		ReactiveFormsModule,
		FormsModule,
		TranslateModule,
		SharedModule
	],
	declarations: [ExportComponent],
	exports: [ExportComponent],
	providers: [ExportAllService]
})
export class ExportModule {}
