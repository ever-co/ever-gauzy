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
import { TranslatePipe } from '@ngx-translate/core';
import {
	EmployeeMultiSelectModule,
	SmartDataViewLayoutModule,
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
		TranslatePipe,
		SmartDataViewLayoutModule,
		SharedModule
	],
	declarations: []
})
export class HelpCenterModule {}
