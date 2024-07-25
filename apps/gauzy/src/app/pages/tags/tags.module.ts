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
import { TranslateModule } from '@ngx-translate/core';
import {
	CardGridModule,
	GauzyButtonActionModule,
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
		TranslateModule.forChild(),
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
