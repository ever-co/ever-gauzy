import { Component, Input, OnInit, TemplateRef } from '@angular/core';

@Component({
	selector: 'ga-widget',
	templateUrl: './widget.component.html',
	styleUrls: ['./widget.component.scss']
})
export class WidgetComponent implements OnInit {
	@Input()
	templateRef: TemplateRef<HTMLElement>;
	constructor() {}
	ngOnInit(): void {}
}
