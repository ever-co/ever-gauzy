import { Component } from '@angular/core';
import { TreeModel, NodeEvent, MenuItemSelectedEvent } from 'ng2-tree';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
	public articleName = 'Chose any article';
	public articleNameContent = 'any article you will chose';
	public tree: TreeModel = {
		value: 'Knowledge Bases',
		children: [
			{
				value: 'Knowledge Base 1',
				children: [
					{ value: 'calendar', icon: 'attach-outline' },
					{ value: 'download', icon: 'attach-outline' },
					{ value: 'group', icon: 'attach-outline' },
					{ value: 'print', icon: 'attach-outline' }
				]
			},
			{
				value: 'Knowledge Base 2',
				children: [
					{ value: 'pointer', icon: 'attach-outline' },
					{ value: 'grab', icon: 'attach-outline' },
					{ value: 'thumbs up', icon: 'calendar-outline' },
					{ value: 'thumbs down', icon: 'calendar-outline' }
				]
			},
			{
				value: 'Knowledge Base 3',
				children: [
					{ value: 'file', icon: 'calendar-outline' },
					{ value: 'audio', icon: 'calendar-outline' },
					{ value: 'movie', icon: 'calendar-outline' },
					{ value: 'archive', icon: 'calendar-outline' }
				]
			}
		]
	};

	private static logEvent(e: NodeEvent, message: string): void {
		console.log(e);
		console.log(`${message}: ${e.node.value}`);
	}
	public changeValue(e: NodeEvent) {
		this.articleNameContent = e.node.value;
		this.articleName = e.node.value;
	}

	public onNodeRemoved(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Removed');
	}

	public onNodeMoved(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Moved');
	}

	public onNodeRenamed(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Renamed');
	}

	public onNodeCreated(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Created');
	}

	public onNodeSelected(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Selected');
		this.changeValue(e);
	}

	public onNodeUnselected(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Unselected');
	}

	public onMenuItemSelected(e: MenuItemSelectedEvent) {
		SidebarComponent.logEvent(
			e,
			`You selected ${e.selectedItem} menu item`
		);
	}

	public onNodeExpanded(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Expanded');
	}

	public onNodeCollapsed(e: NodeEvent): void {
		SidebarComponent.logEvent(e, 'Collapsed');
	}
}
