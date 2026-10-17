import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { EntitySelectPanelDirective } from '../entity-select-panel.directive';
import { ProjectSelectorComponent } from './project/project.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbSelectModule, NgSelectModule, TranslatePipe, EntitySelectPanelDirective],
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent]
})
export class ProjectSelectModule {}
