import { Component, OnInit, Input } from '@angular/core';
import { IPipelineStage } from '@gauzy/contracts';

@Component({
    selector: 'gauzy-stage',
    templateUrl: './stage.component.html',
    styleUrls: ['./stage.component.scss'],
    standalone: false
})
export class StageComponent implements OnInit {

	@Input() value: any;

	pipelineStages: IPipelineStage[];

	constructor() { }

	ngOnInit(): void {
		this.pipelineStages = this.value;
	}
}
