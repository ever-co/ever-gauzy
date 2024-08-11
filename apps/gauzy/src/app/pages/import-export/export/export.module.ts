import { NgModule } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';
import { FileUploaderModule, SharedModule } from '@gauzy/ui-core/shared';
import { ExportComponent } from './export.component';
import { ExportRoutingModule } from './export-routing.module';

@NgModule({
	imports: [
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		FileUploaderModule,
		SharedModule,
		ExportRoutingModule
	],
	declarations: [ExportComponent],
	exports: [ExportComponent],
	providers: [ExportAllService]
})
export class ExportModule {}
