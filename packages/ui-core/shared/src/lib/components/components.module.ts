import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { AlertModalComponent } from './alert-modal/alert-modal.component';
import { AvatarComponent } from './avatar/avatar.component';
import { BackNavigationComponent } from './back-navigation/back-navigation.component';
import { BadgeLabelComponent } from './badge-label/badge-label.component';
import { DashboardSkeletonComponent } from './dashboard-skeleton/dashboard-skeleton.component';
import { DateRangeTitleComponent } from './date-range-title/date-range-title.component';
import { HeaderTitleComponent } from './header-title/header-title.component';
import { LayoutSelectorComponent } from './layout-selector/layout-selector.component';
import { UnderConstructionPopupComponent } from './popup/popup.component';
import { SearchInputComponent } from './search-input/search-input.component';

const STANDALONE_COMPONENTS = [
	DateRangeTitleComponent,
	HeaderTitleComponent
];

const DECLARED_COMPONENTS = [
	AlertModalComponent,
	AvatarComponent,
	BackNavigationComponent,
	BadgeLabelComponent,
	DashboardSkeletonComponent,
	LayoutSelectorComponent,
	SearchInputComponent,
	UnderConstructionPopupComponent
];

export const Components = [...STANDALONE_COMPONENTS, ...DECLARED_COMPONENTS];

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbBadgeModule,
		NbButtonModule,
		NbTooltipModule,
		NbIconModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		...STANDALONE_COMPONENTS
	],
	declarations: [...DECLARED_COMPONENTS],
	exports: [...Components]
})
export class ComponentsModule {}
