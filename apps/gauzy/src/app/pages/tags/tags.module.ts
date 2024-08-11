import { NgModule } from '@angular/core';
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
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	SharedModule,
	TagsMutationModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { TagsComponent } from './tags.component';
import { TagsRoutingModule } from './tags-routing.module';
import { TagsColorComponent } from './tags-color/tags-color.component';

@NgModule({
	imports: [
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
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		ColorPickerModule,
		TagsRoutingModule,
		SharedModule,
		UserFormsModule,
		TagsMutationModule,
		CardGridModule,
		SmartDataViewLayoutModule
	],
	declarations: [TagsComponent, TagsColorComponent]
})
export class TagsModule {}
