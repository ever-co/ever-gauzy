import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        NbCardModule,
        NbIconModule,
        NbBadgeModule,
        NbButtonModule,
        NbSelectModule,
        NbTooltipModule,
        DesktopDirectiveModule,
        PipeModule,
        OverviewTabComponent
    ]
})
export class OverviewTabModule { }
