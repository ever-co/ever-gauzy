import { Component, OnInit } from '@angular/core';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { Pipeline, UserOrganization } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';



@Component({
  templateUrl: './pipelines.component.html',
  selector: 'ga-pipelines',
})
export class PipelinesComponent implements OnInit
{

  public userOrganizations: UserOrganization[];

  public userOrganization: UserOrganization;

  public pipelines: Pipeline[];

  public pipeline: Pipeline;

  public constructor(
    private store: Store,
    private pipelinesService: PipelinesService,
    private usersOrganizationsService: UsersOrganizationsService)
  {
  }

  public ngOnInit()
  {
    this.usersOrganizationsService
      .getAll( [ 'organization' ], {
        userId: this.store.userId,
      })
      .then( ({ items }) => {
        this.userOrganization = items[0];
        this.userOrganizations = items;
        this.updatePipelines();
      });
  }

  public updatePipelines(): void {
    if ( !this.userOrganization?.id ) return;
    this.pipelinesService.find( [], {
      organizationId: this.userOrganization?.organization?.id,
    }).then( items => this.pipelines = items );
  }

}
