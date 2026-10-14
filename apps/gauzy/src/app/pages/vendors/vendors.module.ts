import { NgModule } from '@angular/core';
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
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	FavoriteToggleModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	RecordViewModule
} from '@gauzy/ui-core/shared';
import { VendorsComponent } from './vendors.component';
import { VendorsRoutingModule } from './vendors-routing.module';

// Nebular Modules
const NB_MODULES = [
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbTooltipModule,
	NbActionsModule,
	NbBadgeModule,
	NbDialogModule.forChild(),
	NbSpinnerModule
];

// Standalone Modules
const STANDALONE_MODULES = [
	InfiniteScrollDirective // Standalone directive must be imported, not declared
];

// Third Party Modules
const THIRD_PARTY_MODULES = [TranslatePipe, NgxPermissionsModule.forChild()];

@NgModule({
	imports: [
		RecordViewModule,
		...STANDALONE_MODULES,
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		SharedModule,
		TagsColorInputModule,
		TableComponentsModule,
		VendorsRoutingModule,
		SmartDataViewLayoutModule,
		FavoriteToggleModule,
		CardGridModule
	],
	declarations: [VendorsComponent]
})
export class VendorsModule {}
