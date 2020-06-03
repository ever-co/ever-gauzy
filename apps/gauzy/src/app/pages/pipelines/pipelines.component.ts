import { Component, OnInit } from '@angular/core';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { UserOrganization } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';



@Component({
  templateUrl: './pipelines.component.html',
  selector: 'ga-pipelines',
})
export class PipelinesComponent implements OnInit
{

  public userOrganizations: UserOrganization[];

  public userOrganization: UserOrganization;

  public constructor(
    private store: Store,
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
        this.userOrganizations = items;
        this.userOrganization = items[0];
      });
  }

}
