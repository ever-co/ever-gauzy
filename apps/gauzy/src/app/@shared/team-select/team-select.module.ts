import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { SharedModule } from '../shared.module';
import { TeamSelectorComponent } from './team/team.component';

@NgModule({
	declarations: [TeamSelectorComponent],
	exports: [TeamSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, TranslateModule.forChild(), NgSelectModule, SharedModule]
})
export class TeamSelectModule {}
