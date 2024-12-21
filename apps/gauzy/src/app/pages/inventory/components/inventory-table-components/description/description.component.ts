import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'gauzy-description',
    templateUrl: './description.component.html',
    styleUrls: ['./description.component.css'],
    standalone: false
})
export class DescriptionComponent implements OnInit {

	@Input() value: string | number;
	@Input() rowData: any;

	constructor() { }

	ngOnInit(): void {
	}
}
