import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'ga-no-image',
    templateUrl: './no-image.component.html',
    styleUrls: ['./no-image.component.scss'],
    standalone: false
})
export class NoImageComponent implements OnInit {
	@Input() placeholder: string = 'NO_IMAGE.AVAILABLE';
	@Input() fontSize: number = 9;
	constructor() {}

	ngOnInit(): void {}
}
