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
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TagsRoutingModule } from './tags-routing.module';
import { TagsMutationModule } from '../../@shared/tags/tags-mutation.module';
import { ColorPickerModule } from 'ngx-color-picker';
import { TagsColorComponent } from './tags-color/tags-color.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	imports: [
		NbListModule,
		TagsRoutingModule,
		ThemeModule,
		SharedModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Angular2SmartTableModule,
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
		CardGridModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		NgxPermissionsModule.forChild()
	],
	declarations: [TagsComponent, TagsColorComponent]
})
export class TagsModule {}
