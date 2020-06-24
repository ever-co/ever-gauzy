import { NgModule } from '@angular/core';
import { ThemeModule, HttpLoaderFactory } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbSelectModule,
	NbInputModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { AddBaseComponent } from './add-base.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		NbSelectModule,
		FormsModule,
		ReactiveFormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	entryComponents: [AddBaseComponent],
	declarations: [AddBaseComponent],
	exports: [AddBaseComponent]
})
export class AddBaseModule {}
