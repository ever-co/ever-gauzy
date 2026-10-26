import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { GoalSettingsComponent } from './goal-settings.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { KPI_RECORD_VIEW, TIME_FRAME_RECORD_VIEW } from './goal-settings-record-view';

const routes: Routes = [
	{ path: '', component: GoalSettingsComponent },
	// One KPI / time frame, full width: where the settings drawer's "expand to full width" icon leads.
	{
		path: 'kpi/:id',
		component: RecordViewRoutePageComponent,
		data: { selectors: { project: false, team: false, employee: false, date: false }, recordView: KPI_RECORD_VIEW }
	},
	{
		path: 'time-frame/:id',
		component: RecordViewRoutePageComponent,
		data: {
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: TIME_FRAME_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GoalSettingsRoutingModule {}
