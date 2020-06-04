import { Component, OnInit } from '@angular/core';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { Pipeline, PipelineCreateInput, UserOrganization } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { LocalDataSource } from 'ng2-smart-table';



@Component({
  templateUrl: './pipelines.component.html',
  selector: 'ga-pipelines',
})
export class PipelinesComponent implements OnInit
{

  public pipelines = new LocalDataSource( [] as Pipeline[] );

  public createInput: PipelineCreateInput = {} as any;

  public userOrganizations: UserOrganization[];

  public isCreating = false;

  public constructor(
    private store: Store,
    private pipelinesService: PipelinesService,
    private usersOrganizationsService: UsersOrganizationsService)
  {
  }

  public ngOnInit()
  {
    const { userId } = this.store;
    this.usersOrganizationsService
      .getAll( [ 'organization' ], { userId })
      .then( ({ items }) => {
        this.createInput.organizationId = items[0]?.organization?.id;
        this.userOrganizations = items;
        this.updatePipelines();
      });
  }

  public get canCreate(): boolean {
    return !(this.isCreating
      || !this.createInput.name
      || !this.createInput.organizationId);
  }

  public updatePipelines(): void {
    const { organizationId } = this.createInput;

    this.pipelinesService
      .find( [], { organizationId })
      .then( ({ items }) => this.pipelines.load( items ) );
  }

  public createPipeline() {
    this.isCreating = true;
    this.pipelinesService
      .create( this.createInput )
      .then( () => this.updatePipelines() )
      .finally( () => {
        delete this.createInput.name;
        this.isCreating = false;
        this.updatePipelines();
      });
  }

}
