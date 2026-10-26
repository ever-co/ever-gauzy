import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'gauzy-name-with-description',
    templateUrl: './name-with-description.component.html',
    styleUrls: ['./name-with-description.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class NameWithDescriptionComponent implements OnInit {
	@Input() value: string | number;
	@Input() rowData: any;

	constructor() { }
	ngOnInit(): void { }
}
