import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TeamRoutingModule } from './team-routing.module';
import { TeamComponent } from './team.component';
import { NbCardModule } from "@nebular/theme";


@NgModule({
    declarations: [
        TeamComponent
    ],
    imports: [
        CommonModule,
        TeamRoutingModule,
        NbCardModule
    ]
})
export class TeamModule {
}
