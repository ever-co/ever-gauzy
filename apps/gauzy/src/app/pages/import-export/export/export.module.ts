import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbRadioModule,
	NbSpinnerModule
} from '@nebular/theme';
import { ExportAllService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { FileUploaderModule, SharedModule } from '@gauzy/ui-core/shared';
import { ExportComponent } from './export.component';
import { ExportRoutingModule } from './export-routing.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		FileUploaderModule,
		SharedModule,
		ExportRoutingModule
	],
	declarations: [ExportComponent],
	exports: [ExportComponent],
	providers: [ExportAllService]
})
export class ExportModule {}
