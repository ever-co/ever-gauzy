import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AvatarComponent } from './avatar/avatar.component';
import { BackNavigationComponent } from './back-navigation/back-navigation.component';
import { BadgeLabelComponent } from './badge-label/badge-label.component';
import { DateRangeTitleComponent } from './date-range-title/date-range-title.component';
import { HeaderTitleComponent } from './header-title/header-title.component';
import { LayoutSelectorComponent } from './layout-selector/layout-selector.component';
import { UnderConstructionPopupComponent } from './popup/popup.component';
import { SearchInputComponent } from './search-input/search-input.component';
import { PipesModule } from '../pipes/pipes.module';

export const Components = [
	AvatarComponent,
	BackNavigationComponent,
	BadgeLabelComponent,
	DateRangeTitleComponent,
	HeaderTitleComponent,
	LayoutSelectorComponent,
	SearchInputComponent,
	UnderConstructionPopupComponent
];

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbBadgeModule,
		NbButtonModule,
		NbTooltipModule,
		NbIconModule,
		PipesModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild()
	],
	declarations: [...Components],
	exports: [...Components]
})
export class ComponentsModule {}
