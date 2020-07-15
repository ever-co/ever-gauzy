import { AddArticleModule } from './add-article/add-article.module';
import { SidebarModule } from './../../@shared/sidebar/sidebar.module';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HelpCenterComponent } from './help-center.component';
import { HelpCenterRoutingModule } from './help-center-routing.module';
import { DeleteArticleModule } from './delete-article/delete-article.module';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [HelpCenterComponent]
})
export class HelpCenterModule {}
