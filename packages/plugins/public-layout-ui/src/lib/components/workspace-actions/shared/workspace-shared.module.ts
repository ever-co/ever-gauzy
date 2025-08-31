import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbFormFieldModule, NbInputModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';

import { EmailCodeFormComponent } from './email-code-form/email-code-form.component';
import { WorkspaceHeaderComponent } from './workspace-header/workspace-header.component';
import { WorkspaceSelectionComponent } from './workspace-selection/workspace-selection.component';

/**
 * Shared module for workspace action components.
 * Contains reusable UI components that are used across workspace-create, workspace-signin, and workspace-find.
 */
@NgModule({
	declarations: [EmailCodeFormComponent, WorkspaceHeaderComponent, WorkspaceSelectionComponent],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NbFormFieldModule,
		NbInputModule,
		NbTooltipModule,
		TranslateModule,
		SharedModule,
		ThemeModule
	],
	exports: [EmailCodeFormComponent, WorkspaceHeaderComponent, WorkspaceSelectionComponent]
})
export class WorkspaceSharedModule {}
