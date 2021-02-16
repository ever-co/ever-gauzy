import { NgModule } from '@angular/core';
import { ImportExportRoutingModule } from './import-export-routing.module';
import { ImportExportComponent } from './import-export.component';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [
		ImportExportRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule
	],
	declarations: [ImportExportComponent],
	providers: []
})
export class ImportExportModule {}
