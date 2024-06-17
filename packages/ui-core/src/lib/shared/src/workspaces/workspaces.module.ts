import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbContextMenuModule } from '@nebular/theme';
import { WorkspacesComponent } from './workspaces.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbContextMenuModule],
	declarations: [WorkspacesComponent],
	exports: [WorkspacesComponent]
})
export class WorkspacesModule {}
