import { NgModule } from '@angular/core';
import { ImportExportRoutingModule } from './import-export-routing.module';
import { ImportExportComponent } from './import-export.component';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		ImportExportRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslaterModule
	],

	declarations: [ImportExportComponent],
	providers: []
})
export class ImportExportModule {}
