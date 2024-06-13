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
import { ExportAllService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { FileUploaderModule, SharedModule } from '@gauzy/ui-core/shared';

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
		I18nTranslateModule.forChild(),
		SharedModule
	],
	declarations: [ExportComponent],
	exports: [ExportComponent],
	providers: [ExportAllService]
})
export class ExportModule {}
