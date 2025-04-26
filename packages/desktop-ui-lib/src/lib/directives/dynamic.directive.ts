import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
    selector: '[dynamicDirective]',
    standalone: false
})
export class DynamicDirective {
	constructor(public viewContainerRef: ViewContainerRef) {}
}
