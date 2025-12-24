import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DesktopDirectiveModule } from '../../../../../../../directives/desktop-directive.module';
import { InfiniteScrollDirective } from '../../../../../../../directives/infinite-scroll.directive';
import { PipeModule } from '../../../../../../../time-tracker/pipes/pipe.module';
import { UserManagementTabComponent } from './user-management-tab.component';

const routes: Routes = [
	{
		path: '',
		component: UserManagementTabComponent
	}
];

@NgModule({
	declarations: [UserManagementTabComponent],
	imports: [
		CommonModule,
		RouterModule.forChild(routes),
		TranslateModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbUserModule,
		NbBadgeModule,
		NbTooltipModule,
		NbListModule,
		NbAlertModule,
		PipeModule,
		DesktopDirectiveModule,
		InfiniteScrollDirective
	]
})
export class UserManagementTabModule {}
