import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbRadioModule,
	NbToastrModule,
	NbBadgeModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ImportComponent } from './import.component';
import { FileUploadModule } from 'ng2-file-upload';
import { ThemeModule } from '../../../@theme/theme.module';
import { ImportRoutingModule } from './import-routing.module';
import { ExportAllService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { FileUploaderModule, SharedModule } from '@gauzy/ui-core/shared';
import { GauzyButtonActionModule } from '@gauzy/ui-core/shared';

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
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SharedModule,
		NbBadgeModule,
		NbTooltipModule,
		GauzyButtonActionModule,
		SharedModule,
		NbSpinnerModule
	],
	declarations: [ImportComponent],
	exports: [ImportComponent],
	providers: [ExportAllService]
})
export class ImportModule {}
