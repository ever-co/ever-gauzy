import { ChangeDetectionStrategy, Input } from '@angular/core';
import { Component } from '@angular/core';
import { EventEmitter } from '@angular/core';
import { TreeNode } from './tree.component';

@Component({
	selector: 'ga-tree-node',
	outputs: ['selectEvents: select'],
	// tslint:disable-next-line: no-host-metadata-property
	host: {
		'[class.selected]': '( node === selectedNode )'
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './tree-node.component.html'
})
export class TreeNodeComponent {
	@Input() node: TreeNode | null;
	@Input() selectedNode: TreeNode | null;
	public selectEvents: EventEmitter<TreeNode>;

	constructor() {
		this.node = null;
		this.selectedNode = null;
		this.selectEvents = new EventEmitter();
	}
}
