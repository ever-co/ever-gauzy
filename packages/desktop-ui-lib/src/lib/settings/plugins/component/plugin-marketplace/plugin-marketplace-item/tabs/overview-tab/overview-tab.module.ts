import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DesktopDirectiveModule } from '../../../../../../../directives/desktop-directive.module';
import { PipeModule } from '../../../../../../../time-tracker/pipes/pipe.module';
import { OverviewTabComponent } from './overview-tab.component';

const routes: Routes = [
	{
		path: '',
		component: OverviewTabComponent
	}
];

@NgModule({
	declarations: [OverviewTabComponent],
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(routes),
		TranslateModule,
		NbCardModule,
		NbIconModule,
		NbBadgeModule,
		NbButtonModule,
		NbSelectModule,
		NbTooltipModule,
		DesktopDirectiveModule,
		PipeModule
	]
})
export class OverviewTabModule {}
