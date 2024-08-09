import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbTooltipModule,
	NbActionsModule,
	NbBadgeModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { VendorsComponent } from './vendors.component';
import { VendorsRoutingModule } from './vendors-routing.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbTooltipModule,
		NbActionsModule,
		NbBadgeModule,
		NbDialogModule.forChild(),
		NbSpinnerModule,
		InfiniteScrollModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SharedModule,
		TagsColorInputModule,
		TableComponentsModule,
		VendorsRoutingModule,
		SmartDataViewLayoutModule
	],
	declarations: [VendorsComponent]
})
export class VendorsModule {}
