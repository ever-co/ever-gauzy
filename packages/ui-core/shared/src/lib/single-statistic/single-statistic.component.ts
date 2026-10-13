import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-single-statistic',
    templateUrl: './single-statistic.component.html',
    styleUrls: ['./single-statistic.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SingleStatisticComponent implements OnInit {
	@Input() title: string;
	@Input() prefix: string;
	@Input() value: string;
	@Input() suffix: string;
	@Input() type: string;
  @Input() color:string;
	constructor() {}

	ngOnInit() {}
}
