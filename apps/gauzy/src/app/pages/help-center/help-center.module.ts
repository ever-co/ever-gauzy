import { AddArticleModule } from './add-article/add-article.module';
import { SidebarModule } from './../../@shared/sidebar/sidebar.module';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HelpCenterComponent } from './help-center.component';
import { HelpCenterRoutingModule } from './help-center-routing.module';
import { DeleteArticleModule } from './delete-article/delete-article.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	EmployeeMultiSelectModule,
	GauzyButtonActionModule,
	SharedModule,
	UserFormsModule
} from '@gauzy/ui-sdk/shared';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		AddArticleModule,
		DeleteArticleModule,
		HelpCenterRoutingModule,
		ThemeModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbTooltipModule,
		NbSpinnerModule,
		ReactiveFormsModule,
		EmployeeMultiSelectModule,
		SidebarModule,
		I18nTranslateModule.forChild(),
		GauzyButtonActionModule,
		SharedModule,
		NoDataMessageModule
	],
	declarations: [HelpCenterComponent]
})
export class HelpCenterModule {}
