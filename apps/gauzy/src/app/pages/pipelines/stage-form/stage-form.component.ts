import { Component, Input, OnInit } from '@angular/core';
import { ControlContainer, FormArray, FormBuilder, Validators } from '@angular/forms';
import { StageCreateInput } from '@gauzy/models';

@Component({
  templateUrl: './stage-form.component.html',
  selector: 'ga-stage-form',
})
export class StageFormComponent implements OnInit
{

  @Input( 'values' )
  public stages: StageCreateInput[];

  @Input()
  public pipelineId: string;

  public control: FormArray;

  public isAdding = false;

  public constructor(
    private fb: FormBuilder,
    private readonly controlContainer: ControlContainer )
  {
  }

  public ngOnInit(): void
  {
    this.control = this.controlContainer.control as FormArray;
    this.stages?.forEach( ({ name, description }) => this.pushNewStage({ name, description }) );
  }

  public pushNewStage({ name, description }: Omit<StageCreateInput, 'pipelineId'> = {} as any ): void {
    const { pipelineId } = this;

    this.control.push( this.fb.group({
      ...pipelineId ? { pipelineId: [ pipelineId, Validators.required ] } : {},
      name: [ name, Validators.required ],
      description: [ description ],
    }) );
  }

}
