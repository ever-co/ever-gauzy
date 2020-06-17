import { Component, Input, OnInit } from '@angular/core';
import { ControlContainer, FormArray, FormBuilder, Validators } from '@angular/forms';
import { StageUpdateInput } from '@gauzy/models';

@Component({
  templateUrl: './stage-form.component.html',
  selector: 'ga-stage-form',
})
export class StageFormComponent implements OnInit
{

  @Input( 'values' )
  public stages: StageUpdateInput[];

  @Input()
  public pipelineId: string;

  public control: FormArray;

  public isAdding = false;

  public constructor(
    private readonly controlContainer: ControlContainer,
    private fb: FormBuilder )
  {
  }

  public ngOnInit(): void
  {
    this.control = this.controlContainer.control as FormArray;
    this.stages?.forEach( ({ id, name, description }) => this.pushNewStage({ id, name, description }) );
  }

  public pushNewStage({ id, name, description }: Omit<StageUpdateInput, 'pipelineId'> = {} as any ): void {
    const { pipelineId } = this;

    this.control.push( this.fb.group({
      ...pipelineId ? { pipelineId: [ pipelineId, Validators.required ] } : {},
      ...id ? { id: [ id, Validators.required ] } : {},
      name: [ name, Validators.required ],
      description: [ description ],
    }) );
  }

}
