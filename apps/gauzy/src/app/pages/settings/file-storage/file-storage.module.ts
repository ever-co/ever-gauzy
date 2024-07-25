import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { FileProviderSelectorModule } from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { FileStorageRoutingModule } from './file-storage-routing.module';
import { FileStorageComponent } from './file-storage.component';

@NgModule({
	imports: [
		FileStorageRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		SharedModule,
		FileProviderSelectorModule
	],
	declarations: [FileStorageComponent],
	providers: []
})
export class FileStorageModule {}
