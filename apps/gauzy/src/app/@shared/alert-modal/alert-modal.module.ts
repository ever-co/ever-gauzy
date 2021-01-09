import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertModalComponent } from './alert-modal.component';
import { NbCardModule, NbButtonModule, NbDialogModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/theme.module';
import { HttpClient } from '@angular/common/http';

@NgModule({
	declarations: [AlertModalComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbDialogModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	]
})
export class AlertModalModule {}
