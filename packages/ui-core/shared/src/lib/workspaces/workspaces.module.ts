import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbContextMenuModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { WorkspacesComponent } from './workspaces.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbContextMenuModule, NbIconModule, NbSpinnerModule],
	declarations: [WorkspacesComponent],
	exports: [WorkspacesComponent]
})
export class WorkspacesModule {}
