import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-github-repository',
	templateUrl: './repository.component.html',
	styleUrls: ['./repository.component.scss']
})
export class GithubRepositoryComponent implements OnInit, ViewCell {

	@Input() value: any;
	@Input() rowData: any;

	constructor() { }

	ngOnInit(): void { }
}
