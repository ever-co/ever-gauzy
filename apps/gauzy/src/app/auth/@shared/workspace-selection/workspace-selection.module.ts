import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbListModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { WorkspaceSelectionComponent } from './workspace-selection.component';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbIconModule, NbListModule, TranslateModule.forChild(), SharedModule],
	declarations: [WorkspaceSelectionComponent],
	exports: [WorkspaceSelectionComponent],
	providers: []
})
export class WorkspaceSelectionModule {}
