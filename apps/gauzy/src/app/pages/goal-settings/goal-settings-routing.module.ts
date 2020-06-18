import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { GoalSettingsComponent } from './goal-settings.component';

const routes: Routes = [{ path: '', component: GoalSettingsComponent }];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GoalSettingsRoutingModule {}
