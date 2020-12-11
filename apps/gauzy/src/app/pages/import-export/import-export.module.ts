import { NgModule } from '@angular/core';
import { ImportExportRoutingModule } from './import-export-routing.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { ImportExportComponent } from './import-export.component';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { HttpLoaderFactory } from '../../@theme/theme.module';
@NgModule({
	imports: [
		ImportExportRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],

	declarations: [ImportExportComponent],
	providers: []
})
export class ImportExportModule {}
