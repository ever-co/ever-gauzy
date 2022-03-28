import { Component, OnInit, Input } from '@angular/core';
import { IPipelineStage } from '../../../../../../../packages/contracts/dist/pipeline-stage.model';

@Component({
  selector: 'gauzy-stage',
  templateUrl: './stage.component.html',
  styleUrls: ['./stage.component.scss']
})
export class StageComponent implements OnInit {

  @Input() value: any;

  pipelineStages: IPipelineStage[];

  constructor() { }

  ngOnInit(): void {
    this.pipelineStages = this.value;
  }

}
