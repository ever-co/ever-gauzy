import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { ImportExportRoutingModule } from './import-export-routing.module';
import { ImportExportComponent } from './import-export.component';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DialogsModule } from '../../@shared/dialogs';

@NgModule({
	imports: [
		CommonModule,
		DialogsModule,
		ImportExportRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NgxPermissionsModule.forChild(),
		TranslateModule
	],
	declarations: [ImportExportComponent],
	providers: []
})
export class ImportExportModule {}