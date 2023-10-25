import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-github-repository',
	templateUrl: './github-repository.component.html',
	styleUrls: ['./github-repository.component.scss']
})
export class GithubRepositoryComponent implements OnInit, ViewCell {

	@Input() value: any;
	@Input() rowData: any;

	constructor() { }

	ngOnInit(): void { }
}
