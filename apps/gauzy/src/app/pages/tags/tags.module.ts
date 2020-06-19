import { NgModule } from '@angular/core';
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
	NbTooltipModule,
	NbRadioModule,
	NbSpinnerModule,
	NbListModule
} from '@nebular/theme';
import { TagsComponent } from './tags.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { TagsRoutingModule } from './tags-routing.module';
import { TagsMutationModule } from '../../@shared/tags/tags-mutation.module';
import { ColorPickerModule } from 'ngx-color-picker';
import { TagsColorComponent } from './tags-color/tags-color.component';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		NbListModule,
		TagsRoutingModule,
		ThemeModule,
		UserFormsModule,
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
		NbRadioModule,
		NbSelectModule,
		NbBadgeModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		TagsMutationModule,
		ColorPickerModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule
	],

	entryComponents: [TagsComponent, TagsColorComponent],
	declarations: [TagsComponent, TagsColorComponent]
})
export class TagsModule {}
