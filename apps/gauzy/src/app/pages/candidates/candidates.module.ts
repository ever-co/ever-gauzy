import { CandidatesService } from './../../@core/services/candidates.service';
import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { CountryService } from '../../@core/services/country.service';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { ThemeModule } from '../../@theme/theme.module';
import { InviteGuard } from './../../@core/role/invite.guard';
import { SharedModule } from '../../@shared/shared.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { CandidatesComponent } from './candidates.component';
import { CandidatesRoutingModule } from './candidates-routing.module';
import { CandidateStatusComponent } from './table-components/candidate-status/candidate-status.component';
import { CandidateFullNameComponent } from './table-components/candidate-fullname/candidate-fullname.component';
import { CandidateMutationModule } from '../../@shared/candidate/candidate-mutation/candidate-mutation.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [
	CandidatesComponent,
	CandidateFullNameComponent,
	CandidateStatusComponent
];

@NgModule({
	imports: [
		SharedModule,
		CandidatesRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		NgSelectModule,
		ImageUploaderModule,
		NbBadgeModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		TagsColorInputModule,
		CandidateMutationModule
	],
	declarations: [...COMPONENTS],
	entryComponents: [CandidateStatusComponent, CandidateFullNameComponent],
	providers: [
		OrganizationsService,
		InviteGuard,
		CountryService,
		OrganizationEmploymentTypesService,
		CandidatesService
	]
})
export class CandidatesModule {}
