import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
	selector: '[noSpaceEdges]',
})
export class NoSpaceEdgesDirective {
	constructor(private el: ElementRef) {}

	@HostListener('input', ['$event.target.value'])
	onInput(value: string) {
		this.el.nativeElement.value = value.trim();
	}
}
