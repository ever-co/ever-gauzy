import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TreeComponent } from './tree.component';
import { TreeNodeComponent } from './tree-node.component';

@NgModule({
	imports: [CommonModule],
	exports: [TreeComponent],
	declarations: [TreeComponent, TreeNodeComponent]
})
export class TreeModule {}
