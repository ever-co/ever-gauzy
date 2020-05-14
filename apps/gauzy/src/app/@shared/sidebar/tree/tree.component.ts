import { ChangeDetectionStrategy, Input } from '@angular/core';
import { Component } from '@angular/core';
import { EventEmitter } from '@angular/core';

export interface TreeNode {
	label: string;
	children: TreeNode[];
}

@Component({
	selector: 'ga-tree',
	outputs: ['selectEvents: select'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './tree.component.html'
})
export class TreeComponent {
	@Input() rootNode: TreeNode | null;
	@Input() selectedNode: TreeNode | null;
	public selectEvents: EventEmitter<TreeNode>;

	constructor() {
		this.rootNode = null;
		this.selectedNode = null;
		this.selectEvents = new EventEmitter();
	}
}
