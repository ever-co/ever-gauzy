import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SelectModule } from '../../components/ui/select/select.module';
import { TeamSelectorComponent } from './team-selector.component';

@NgModule({
	declarations: [TeamSelectorComponent],
	exports: [TeamSelectorComponent],
	imports: [CommonModule, SelectModule]
})
export class TeamSelectorModule {}
