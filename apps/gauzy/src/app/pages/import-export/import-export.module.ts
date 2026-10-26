import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogsModule, SharedModule } from '@gauzy/ui-core/shared';
import { ImportExportRoutingModule } from './import-export-routing.module';
import { ImportExportComponent } from './import-export.component';
import { ExternalRedirectComponent } from './external-redirect/external-redirect.component';

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
		SharedModule,
		TranslatePipe
	],
	declarations: [ImportExportComponent, ExternalRedirectComponent],
	providers: []
})
export class ImportExportModule {}
