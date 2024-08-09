import { NgModule } from '@angular/core';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbProgressBarModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgChartsModule } from 'ng2-charts';
import { TranslateModule } from '@ngx-translate/core';
import { CounterPointModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-core/shared';
import { TeamComponent } from './team.component';
import { TeamCardComponent } from './team-card/team-card.component';
import { TeamMemberComponent } from './team-member/team-member.component';
import { ChartComponent } from './chart/chart.component';
import { AllTeamComponent } from './all-team/all-team.component';

@NgModule({
	declarations: [TeamComponent, TeamCardComponent, TeamMemberComponent, ChartComponent, AllTeamComponent],
	imports: [
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbProgressBarModule,
		NbSpinnerModule,
		NgChartsModule,
		SharedModule,
		TranslateModule.forChild(),
		CounterPointModule,
		NoDataMessageModule
	]
})
export class TeamModule {}
