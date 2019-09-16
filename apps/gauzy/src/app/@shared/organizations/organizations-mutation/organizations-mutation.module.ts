import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbToastrModule,
	NbListModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsMutationComponent } from './organizations-mutation.component';
import { ImageUpladerModule } from '../../image-uploader/image-uploader.module';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		ReactiveFormsModule,
		NbInputModule,
		FormsModule,
		NbDatepickerModule,
		ImageUpladerModule,
		NbSelectModule,
		NbToastrModule.forRoot(),
		NbListModule,
		RemoveLodashModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [OrganizationsMutationComponent],
	entryComponents: [OrganizationsMutationComponent],
	providers: [OrganizationDepartmentsService]
})
export class OrganizationsMutationModule {}
