import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TeamSelectorComponent } from './team-selector.component';

@NgModule({
	declarations: [TeamSelectorComponent],
	exports: [TeamSelectorComponent],
	imports: [CommonModule]
})
export class TeamSelectorModule {}
