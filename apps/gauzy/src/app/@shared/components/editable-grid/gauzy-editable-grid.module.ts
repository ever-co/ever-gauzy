import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import {
	NbButtonModule,
	NbIconModule,
	NbCardModule,
	NbListModule,
	NbDialogModule
} from '@nebular/theme';

import { Store } from '../../../@core/services/store.service';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { GauzyEditableGridComponent } from './gauzy-editable-grid.component';

const NbModules = [
	NbButtonModule,
	NbIconModule,
	NbCardModule,
	NbListModule,
	NbDialogModule.forChild()
];

@NgModule({
	imports: [
		ThemeModule,
		[...NbModules],
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [GauzyEditableGridComponent],
	exports: [GauzyEditableGridComponent],
	entryComponents: [],
	providers: [Store]
})
export class GauzyEditableGridModule {}
