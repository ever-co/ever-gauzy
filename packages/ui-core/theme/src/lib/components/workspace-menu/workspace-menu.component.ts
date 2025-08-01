import { Component, EventEmitter, Output } from '@angular/core';

@Component({
	selector: 'gauzy-workspace-menu',
	templateUrl: './workspace-menu.component.html',
	styleUrls: ['./workspace-menu.component.scss'],
	standalone: false
})
export class WorkspaceMenuComponent {
	@Output()
	public close: EventEmitter<void> = new EventEmitter<void>();

	public clicks: boolean[] = [];

	public onClick() {
		this.close.emit();
	}

	public onClickOutside(event: boolean) {
		this.clicks.push(event);
		if (!event && this.clicks.length > 1) this.onClick();
	}
}
