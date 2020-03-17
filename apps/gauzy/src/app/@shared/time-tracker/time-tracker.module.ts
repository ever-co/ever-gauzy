import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackerComponent } from './time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import { NbIconModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';

@NgModule({
	declarations: [TimeTrackerComponent],
	imports: [CommonModule, NbIconModule, NbButtonModule, NbTooltipModule],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: TimeTrackerModule,
			providers: [TimeTrackerService]
		};
	}
}
