import { Component, Input, OnInit } from '@angular/core';

@Component({
	selector: 'ngx-github-repository',
	templateUrl: './repository.component.html',
	styleUrls: ['./repository.component.scss']
})
export class GithubRepositoryComponent implements OnInit {
	@Input() value: any;
	@Input() rowData: any;

	constructor() {}

	ngOnInit(): void {}
}
