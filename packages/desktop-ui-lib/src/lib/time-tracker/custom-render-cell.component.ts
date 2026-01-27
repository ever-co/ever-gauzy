import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'ga-custom-render-selector',
    template: `
		<div class="d-flex align-items-center">
		  @if (isSelected) {
		    <nb-icon
		      class="running-task"
		      status="primary"
		      icon="arrow-right-outline"
		    ></nb-icon>
		  }
		  {{ rowData.taskNumber + ' ' + rowData.title }}
		</div>
		`,
    styleUrls: ['./time-tracker.component.scss'],
    standalone: false
})
export class CustomRenderComponent implements OnInit {
	isSelected: boolean = false;

	@Input() value: string | number;
	@Input() rowData: any;

	ngOnInit() {
		if (this.rowData.isSelected) {
			this.isSelected = true;
		}
	}
}

@Component({
    selector: 'ga-custom-description-selector',
    template: `
		<span class="hidden-long-text">
			{{ value.toString() }}
		</span>
	`,
    styleUrls: ['./time-tracker.component.scss'],
    standalone: false
})
export class CustomDescriptionComponent {

	@Input() value: string | number;
	@Input() rowData: any;
}
