import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';

@Component({
    selector: 'ngx-search-input',
    styleUrls: ['./search-input.component.scss'],
    template: `
		<i class="control-icon ion ion-ios-search" (click)="showInput()"></i>
		<input
			#input
			[placeholder]="'FORM.PLACEHOLDERS.TYPE_SEARCH_REQUEST' | translate"
			[class.hidden]="!isInputShown"
			(blur)="hideInput()"
			(input)="onInput($event)"
		/>
	`,
    standalone: false
})
export class SearchInputComponent {
	isInputShown = false;

	@ViewChild('input', { static: true }) input: ElementRef;
	@Output() search: EventEmitter<string> = new EventEmitter<string>();

	showInput() {
		this.isInputShown = true;
		this.input.nativeElement.focus();
	}

	hideInput() {
		this.isInputShown = false;
	}

	onInput(val: string) {
		this.search.emit(val);
	}
}
