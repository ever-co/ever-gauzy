import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'gauzy-popup',
	templateUrl: './popup.component.html',
	styleUrls: ['./popup.component.scss']
})
export class PopupComponent implements OnInit {
	@Output() onClosed: EventEmitter<any> = new EventEmitter<any>(null);

	constructor() {}

	ngOnInit(): void {}

	close() {
		this.onClosed.emit();
	}
}
