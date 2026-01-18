import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
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

@NgModule({
	declarations: [UserManagementTabComponent],
	imports: [
		CommonModule,
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
export class UserManagementTabModule { }
