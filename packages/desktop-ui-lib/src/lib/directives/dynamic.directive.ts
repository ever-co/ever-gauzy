import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
	selector: '[dynamicDirective]'
})
export class DynamicDirective {
	constructor(public viewContainerRef: ViewContainerRef) {}
}
