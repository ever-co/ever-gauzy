import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityWatchEventService } from './activity-watch-event.service';
import { ActivityWatchComponent } from './view/activity-watch.component';
import { NbIconModule, NbToggleModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ActivityWatchViewService } from './activity-watch-view.service';
import { ActivityWatchElectronService } from './activity-watch-electron.service';

@NgModule({
	declarations: [ActivityWatchComponent],
	exports: [ActivityWatchComponent],
	imports: [CommonModule, NbIconModule, NbTooltipModule, NbToggleModule, TranslateModule],
	providers: [ActivityWatchEventService, ActivityWatchViewService, ActivityWatchElectronService]
})
export class ActivityWatchModule {}
