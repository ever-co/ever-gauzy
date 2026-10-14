import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-integration-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class IntegrationLayoutComponent implements OnInit {
	constructor() {}

	ngOnInit(): void {}
}
