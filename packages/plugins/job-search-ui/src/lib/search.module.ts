import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, ROUTES } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FileUploadModule } from 'ng2-file-upload';
import { PageRouteService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	DialogsModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { createRoutes } from './search.routes';
import { SearchComponent } from './components/search/search.component';
import { COMPONENTS } from './components';

/**
 * NB_MODULES
 */
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTooltipModule,
	NbToggleModule
];

@NgModule({
	imports: [
		CommonModule,
		HttpClientModule,
		FormsModule,
		ReactiveFormsModule,
		RouterModule.forChild([]),
		...NB_MODULES,
		Angular2SmartTableModule,
		CKEditorModule,
		FileUploadModule,
		MomentModule,
		NgxPermissionsModule.forRoot(),
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		DialogsModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		ProposalTemplateSelectModule,
		SelectorsModule,
		SharedModule.forRoot(),
		StatusBadgeModule
	],
	exports: [...COMPONENTS],
	declarations: [SearchComponent, ...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class SearchModule {}
