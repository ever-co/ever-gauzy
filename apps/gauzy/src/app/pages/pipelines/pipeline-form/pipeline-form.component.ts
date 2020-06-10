import { Component, Input, OnInit } from '@angular/core';
import { PipelineCreateInput, UserOrganization } from '@gauzy/models';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { Store } from '../../../@core/services/store.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import { NbDialogRef } from '@nebular/theme';

@Component({
  templateUrl: './pipeline-form.component.html',
  selector: 'ga-pipeline-form',
})
export class PipelineFormComponent implements OnInit
{

  @Input()
  public pipeline: PipelineCreateInput & { id?: string };

  public userOrganizations: UserOrganization[];
  public form: FormGroup;
  public icon: string;

  public constructor(
    private dialogRef: NbDialogRef<PipelineFormComponent[ 'pipeline' ]>,
    private usersOrganizationsService: UsersOrganizationsService,
    private pipelinesService: PipelinesService,
    private fb: FormBuilder,
    private store: Store )
  {
  }

  public ngOnInit(): void
  {
    const { userId } = this.store;

    this.usersOrganizationsService
      .getAll( [ 'organization' ], { userId } )
      .then( ( { items } ) => this.userOrganizations = items );
    this.form = this.fb.group({
      ...this.pipeline?.id ? { id: [ this.pipeline?.id || '', Validators.required ] } : {},
      organizationId: [ this.pipeline?.organizationId || '', Validators.required ],
      name: [ this.pipeline?.name || '', Validators.required ],
      description: [ this.pipeline?.description ],
    });
  }

  public persist(): void {
    const { value, value: { id } } = this.form;

    Promise.race( [ id ?
      this.pipelinesService.update( id, value )
      : this.pipelinesService.create( value ) ]
    ).then( entity => this.dialogRef.close( entity ) );
  }

}
