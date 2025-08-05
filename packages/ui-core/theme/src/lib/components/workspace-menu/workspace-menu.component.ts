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

	private hasInteracted = false;

	public onClick() {
		this.close.emit();
	}

	public onClickOutside(event: boolean) {
		if (!event && this.hasInteracted) {
			this.onClick();
		}
		if (event) {
			this.hasInteracted = true;
		}
	}
}
