import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../../../@shared/shared.module';
import { TranslateModule } from '../../../@shared/translate/translate.module';
import { ThemeModule } from '../../../@theme/theme.module';
import { FileStorageRoutingModule } from './file-storage-routing.module';
import { FileStorageComponent } from './file-storage.component';

@NgModule({
	imports: [
		FileStorageRoutingModule,
		FormsModule,
		SharedModule,
		TranslateModule,
		NgxPermissionsModule.forChild(),
		ThemeModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule
	],
	declarations: [
		FileStorageComponent
	],
	providers: []
})
export class FileStorageModule {}
