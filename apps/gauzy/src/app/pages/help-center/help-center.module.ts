import { AddArticleModule } from './add-article/add-article.module';
import { SidebarModule } from './../../@shared/sidebar/sidebar.module';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HelpCenterComponent } from './help-center.component';
import { HelpCenterRoutingModule } from './help-center-routing.module';
import { DeleteArticleModule } from './delete-article/delete-article.module';
import { TranslaterModule } from '../../@shared/translater/translater.module';

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
		TranslaterModule
	],
	declarations: [HelpCenterComponent]
})
export class HelpCenterModule {}
