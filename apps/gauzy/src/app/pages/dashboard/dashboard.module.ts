import { DashboardComponent } from './dashboard.component';
import { NgModule } from '@angular/core';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbCalendarModule, NbCalendarKitModule, NbButtonModule, NbInputModule, NbDatepickerModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

@NgModule({
    imports: [
        DashboardRoutingModule,
        ThemeModule,
        NbCardModule,
        NgSelectModule,
        FormsModule,
        NbCalendarModule,
        NbCalendarKitModule,
        NbButtonModule,
        NbInputModule,
        NbDatepickerModule
    ],
    declarations: [
        DashboardComponent
    ]
  })
  export class DashboardModule { }