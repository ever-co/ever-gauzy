import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import {
	NbButtonModule,
	NbIconModule,
	NbCardModule,
	NbInputModule,
	NbFormFieldModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { WorkspaceFindComponent } from './workspace-find.component';
import { CountdownTimerService, WorkspaceAuthService } from '../shared';
import { WorkspaceSharedModule } from '../shared/workspace-shared.module';
import { TenantService } from '@gauzy/ui-core/core';

const routes: Routes = [
	{
		path: '',
		component: WorkspaceFindComponent
	}
];

@NgModule({
	declarations: [WorkspaceFindComponent],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		RouterModule.forChild(routes),
		NbButtonModule,
		NbIconModule,
		NbCardModule,
		NbInputModule,
		NbFormFieldModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		SharedModule,
		ThemeModule,
		WorkspaceSharedModule
	],
	providers: [TenantService, CountdownTimerService, WorkspaceAuthService]
})
export class WorkspaceFindModule {}
