import {
	Directive,
	ElementRef,
	EventEmitter,
	Output,
	HostListener
} from '@angular/core';

@Directive({
	selector: '[gauzyOutside]'
})
export class OutsideDirective {
	constructor(private elementRef: ElementRef) {}

	@Output() clickOutside = new EventEmitter<MouseEvent>();

	@HostListener('document:click', ['$event', '$event.target'])
	public onClick(event: MouseEvent, targetElement: HTMLElement): void {
		if (!targetElement) {
			return;
		}
		const clickedInside =
			this.elementRef.nativeElement.contains(targetElement);
			this.clickOutside.emit(clickedInside);
	}
}
