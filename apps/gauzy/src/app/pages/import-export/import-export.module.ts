import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DialogsModule } from '@gauzy/ui-sdk/shared';
import { ImportExportRoutingModule } from './import-export-routing.module';
import { ImportExportComponent } from './import-export.component';

@NgModule({
	imports: [
		CommonModule,
		DialogsModule,
		ImportExportRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild()
	],
	declarations: [ImportExportComponent],
	providers: []
})
export class ImportExportModule {}
