import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbRadioModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TagsComponent } from './tags.component';
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
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbRadioModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgSelectModule,
		Angular2SmartTableModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		ColorPickerModule,
		TagsRoutingModule,
		SharedModule,
		UserFormsModule,
		TagsMutationModule,
		CardGridModule,
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [TagsComponent, TagsColorComponent]
})
export class TagsModule {}
