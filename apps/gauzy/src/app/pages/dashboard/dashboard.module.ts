import { DashboardComponent } from './dashboard.component';
import { NgModule } from '@angular/core';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule } from '@nebular/theme';

@NgModule({
    imports: [
        DashboardRoutingModule,
        ThemeModule,
        NbCardModule
    ],
    declarations: [
        DashboardComponent
    ]
  })
  export class DashboardModule { }