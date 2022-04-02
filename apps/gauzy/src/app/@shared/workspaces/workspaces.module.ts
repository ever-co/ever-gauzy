import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspacesComponent } from './workspaces.component';
import { NbButtonModule, NbContextMenuModule } from '@nebular/theme';



@NgModule({
  declarations: [
    WorkspacesComponent
  ],
  exports:[
    WorkspacesComponent
  ],
  imports: [
    CommonModule,
    NbButtonModule,
    NbContextMenuModule
  ]
})
export class WorkspacesModule { }
