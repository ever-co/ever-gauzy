import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { FileProviderSelectorModule } from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { FileStorageRoutingModule } from './file-storage-routing.module';
import { FileStorageComponent } from './file-storage.component';

// Nebular Modules
const NB_MODULES = [NbButtonModule, NbCardModule, NbInputModule, NbSelectModule, NbSpinnerModule, NbToggleModule];

@NgModule({
	imports: [
		...NB_MODULES,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		FileStorageRoutingModule,
		SharedModule,
		FileProviderSelectorModule
	],
	declarations: [FileStorageComponent],
	providers: []
})
export class FileStorageModule {}
