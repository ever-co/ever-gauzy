import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-github-repository',
    templateUrl: './repository.component.html',
    styleUrls: ['./repository.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GithubRepositoryComponent implements OnInit {
	@Input() value: any;
	@Input() rowData: any;

	constructor() {}

	ngOnInit(): void {}
}
