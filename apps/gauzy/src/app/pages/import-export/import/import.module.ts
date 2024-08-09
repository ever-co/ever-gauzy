import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbRadioModule,
	NbSpinnerModule,
	NbToastrModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileUploadModule } from 'ng2-file-upload';
import { ExportAllService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { FileUploaderModule, GauzyButtonActionModule, SharedModule } from '@gauzy/ui-core/shared';
import { ImportComponent } from './import.component';
import { ImportRoutingModule } from './import-routing.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		FileUploadModule,
		HttpClientModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbSpinnerModule,
		NbToastrModule.forRoot(),
		NbTooltipModule,
		ImportRoutingModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		FileUploaderModule,
		GauzyButtonActionModule
	],
	declarations: [ImportComponent],
	exports: [ImportComponent],
	providers: [ExportAllService]
})
export class ImportModule {}
