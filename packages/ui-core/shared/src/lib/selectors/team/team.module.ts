import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TeamSelectorComponent } from './team/team.component';

@NgModule({
	declarations: [TeamSelectorComponent],
	exports: [TeamSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class TeamSelectModule {}
