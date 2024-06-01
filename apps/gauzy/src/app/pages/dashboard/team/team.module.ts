import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbProgressBarModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgChartsModule } from 'ng2-charts';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { SharedModule } from '../../../@shared/shared.module';
import { CounterPointModule } from '../../../@shared/counter-point/counter-point.module';
import { NoDataMessageModule } from '../../../@shared/no-data-message/no-data-message.module';
import { TeamComponent } from './team.component';
import { TeamCardComponent } from './team-card/team-card.component';
import { TeamMemberComponent } from './team-member/team-member.component';
import { ChartComponent } from './chart/chart.component';
import { AllTeamComponent } from './all-team/all-team.component';

@NgModule({
	declarations: [TeamComponent, TeamCardComponent, TeamMemberComponent, ChartComponent, AllTeamComponent],
	imports: [
		CommonModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbProgressBarModule,
		NbSpinnerModule,
		NgChartsModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		HeaderTitleModule,
		CounterPointModule,
		NoDataMessageModule
	]
})
export class TeamModule {}
