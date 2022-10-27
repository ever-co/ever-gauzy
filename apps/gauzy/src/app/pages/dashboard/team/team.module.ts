import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TeamComponent } from './team.component';
import {
    NbBadgeModule,
    NbButtonModule,
    NbCardModule,
    NbIconModule,
    NbProgressBarModule,
    NbSpinnerModule
} from "@nebular/theme";
import { HeaderTitleModule } from "../../../@shared/components/header-title/header-title.module";
import { TeamCardComponent } from './team-card/team-card.component';
import { CounterPointModule } from "../../../@shared/counter-point/counter-point.module";
import { NoDataMessageModule } from "../../../@shared/no-data-message/no-data-message.module";
import { TeamMemberComponent } from './team-member/team-member.component';
import { ChartComponent } from './chart/chart.component';
import { ChartModule } from "angular2-chartjs";
import { SharedModule } from "../../../@shared/shared.module";
import { AllTeamComponent } from './all-team/all-team.component';
import { TranslateModule } from "@ngx-translate/core";


@NgModule({
    declarations: [
        TeamComponent,
        TeamCardComponent,
        TeamMemberComponent,
        ChartComponent,
        AllTeamComponent
    ],
    imports: [
        CommonModule,
        NbCardModule,
        HeaderTitleModule,
        CounterPointModule,
        NoDataMessageModule,
        NbProgressBarModule,
        ChartModule,
        SharedModule,
        NbIconModule,
        NbButtonModule,
        TranslateModule,
        NbBadgeModule,
        NbSpinnerModule
    ]
})
export class TeamModule {
}
