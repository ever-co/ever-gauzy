import { Component, Output, EventEmitter, TemplateRef, ViewChild } from '@angular/core';
import { NbCardComponent } from '@nebular/theme';

@Component({
	selector: 'gauzy-popup',
	templateUrl: './popup.component.html',
	styleUrls: ['./popup.component.scss']
})
export class PopupComponent {
	@Output() onClosed: EventEmitter<any>;
	private _popup: TemplateRef<NbCardComponent>;

	constructor() {
		this.onClosed = new EventEmitter();
	}

	public close() {
		this.onClosed.emit();
	}

	@ViewChild('popup')
	public set popup(content: TemplateRef<NbCardComponent>) {
		if (content) {
			this._popup = content;
		}
	}

	public get popup(): TemplateRef<NbCardComponent> {
		return this._popup;
	}
}
