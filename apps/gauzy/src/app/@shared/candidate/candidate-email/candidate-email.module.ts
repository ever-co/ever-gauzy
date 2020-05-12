import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { FileUploaderModule } from '../../file-uploader-input/file-uploader-input.module';
import { CandidateEmailComponent } from './candidate-email.component';
import { CKEditorModule } from 'ng2-ckeditor';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		ReactiveFormsModule,
		NbIconModule,
		CKEditorModule,
		FileUploaderModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [CandidateEmailComponent],
	declarations: [CandidateEmailComponent],
	entryComponents: [CandidateEmailComponent]
})
export class CandidateEmailModule {}
