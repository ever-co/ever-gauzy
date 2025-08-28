import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbContextMenuModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { WorkspacesComponent } from './workspaces.component';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule.forChild(),
		NbButtonModule,
		NbContextMenuModule,
		NbIconModule,
		NbSpinnerModule
	],
	declarations: [WorkspacesComponent],
	exports: [WorkspacesComponent]
})
export class WorkspacesModule {}
