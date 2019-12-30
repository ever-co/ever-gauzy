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
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ThemeModule } from '../../../@theme/theme.module';
import { InviteMutationModule } from '../invite-mutation/invite-mutation.module';
import { InviteTableComponent } from './invite-table.component';
import { ProjectNamesComponent } from './project-names/project-names.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [InviteTableComponent, ProjectNamesComponent];

@NgModule({
	imports: [
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
		NbSelectModule,
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
		InviteMutationModule
	],
	declarations: [...COMPONENTS],
	exports: [...COMPONENTS],
	entryComponents: [ProjectNamesComponent],
	providers: []
})
export class InviteTableModule {}
