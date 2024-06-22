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
import { ColorPickerModule } from 'ngx-color-picker';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	i4netButtonActionModule,
	PaginationV2Module,
	SharedModule,
	TagsMutationModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { TagsComponent } from './tags.component';
import { TagsRoutingModule } from './tags-routing.module';
import { TagsColorComponent } from './tags-color/tags-color.component';

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
		i4netButtonActionModule,
		PaginationV2Module
	],
	declarations: [TagsComponent, TagsColorComponent]
})
export class TagsModule { }
