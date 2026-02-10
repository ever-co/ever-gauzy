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
import { TenantService, WorkspaceAuthService } from '@gauzy/ui-core/core';
import { WorkspaceFindComponent } from './workspace-find.component';
import { CountdownTimerService, WorkspaceSharedModule } from '../shared';

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
	providers: [TenantService, WorkspaceAuthService, CountdownTimerService]
})
export class WorkspaceFindModule {}
