import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { FileProviderSelectorModule } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { ThemeModule } from '../../../@theme/theme.module';
import { FileStorageRoutingModule } from './file-storage-routing.module';
import { FileStorageComponent } from './file-storage.component';

@NgModule({
	imports: [
		FormsModule,
		ReactiveFormsModule,
		FileStorageRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NgxPermissionsModule.forChild(),
		ThemeModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		FileProviderSelectorModule
	],
	declarations: [FileStorageComponent],
	providers: []
})
export class FileStorageModule {}
