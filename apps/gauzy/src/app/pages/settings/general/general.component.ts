import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'ga-general-settings',
	templateUrl: './general.component.html',
	styleUrls: ['./general.component.css']
})
export class GeneralComponent implements OnInit {
	constructor() { }

	ngOnInit(): void { }

	async providerChanged(provider, $event) { }
}
