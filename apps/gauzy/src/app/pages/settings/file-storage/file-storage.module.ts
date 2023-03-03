import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileProviderModule } from '../../../@shared/selectors/file-provider/file-provider.module';
import { SharedModule } from '../../../@shared/shared.module';
import { TranslateModule } from '../../../@shared/translate/translate.module';
import { ThemeModule } from '../../../@theme/theme.module';
import { FileStorageRoutingModule } from './file-storage-routing.module';
import { FileStorageComponent } from './file-storage.component';

@NgModule({
	imports: [
		FormsModule,
		ReactiveFormsModule,
		FileStorageRoutingModule,
		ThemeModule,
		TranslateModule,
		SharedModule,
		NgxPermissionsModule.forChild(),
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		FileProviderModule
	],
	declarations: [FileStorageComponent],
	providers: []
})
export class FileStorageModule {}
