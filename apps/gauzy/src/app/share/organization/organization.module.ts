import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrganizationComponent } from './organization.component';
import { OrganizationRoutingModule } from './organization-routing.module';
import { PublicPageMutationModule } from '../../@shared/organizations/public-page-mutation/public-page-mutation.module';

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		OrganizationRoutingModule,
		ThemeModule,
		NbCardModule,
		NbDialogModule.forChild(),
		FormsModule,
		ReactiveFormsModule,
		ImageUploaderModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		PublicPageMutationModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [OrganizationComponent],
	entryComponents: [],
	providers: []
})
export class OrganizationModule {}
