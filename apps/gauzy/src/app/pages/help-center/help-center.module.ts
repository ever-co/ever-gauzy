import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	EmployeeMultiSelectModule,
	i4netButtonActionModule,
	NoDataMessageModule,
	SharedModule,
	SidebarModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { HelpCenterComponent } from './help-center.component';
import { HelpCenterRoutingModule } from './help-center-routing.module';
import { DeleteArticleModule } from './delete-article/delete-article.module';
import { AddArticleModule } from './add-article/add-article.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		AddArticleModule,
		DeleteArticleModule,
		HelpCenterRoutingModule,
		UserFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbTooltipModule,
		NbSpinnerModule,
		EmployeeMultiSelectModule,
		SidebarModule,
		I18nTranslateModule.forChild(),
		i4netButtonActionModule,
		SharedModule,
		NoDataMessageModule
	],
	declarations: [HelpCenterComponent]
})
export class HelpCenterModule { }
