import { Component, Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'ngx-calendar-nav',
	template: `
		<button nbButton (click)="prev.emit()" ghost status="basic">
			<nb-icon [icon]="'arrow-back-outline'"></nb-icon>
		</button>
		<button nbButton (click)="next.emit()" status="basic">
			<nb-icon [icon]="'arrow-forward-outline'"></nb-icon>
		</button>
	`,
	styleUrls: ['../time-calendar.component.scss']
})
export class CalendarNavComponent {
	@Output() next = new EventEmitter<true>();
	@Output() prev = new EventEmitter<void>();
}
