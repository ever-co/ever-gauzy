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
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	FavoriteToggleModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
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
const THIRD_PARTY_MODULES = [TranslateModule.forChild(), NgxPermissionsModule.forChild()];

@NgModule({
	imports: [
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
