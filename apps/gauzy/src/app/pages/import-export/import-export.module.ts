import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { DialogsModule } from '@gauzy/ui-core/shared';
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
		TranslateModule.forChild()
	],
	declarations: [ImportExportComponent],
	providers: []
})
export class ImportExportModule {}
