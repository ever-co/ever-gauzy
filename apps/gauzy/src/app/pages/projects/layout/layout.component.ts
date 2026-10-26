import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-project-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProjectLayoutComponent implements OnInit {

	constructor() { }

	ngOnInit(): void { }
}
