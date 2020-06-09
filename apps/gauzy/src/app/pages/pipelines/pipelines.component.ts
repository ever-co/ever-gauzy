import { Component, OnInit } from '@angular/core';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { Pipeline, UserOrganization } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { FormBuilder } from '@angular/forms';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { first } from 'rxjs/operators';



@Component({
  templateUrl: './pipelines.component.html',
  selector: 'ga-pipelines',
})
export class PipelinesComponent extends TranslationBaseComponent implements OnInit
{

  public smartTableSettings = {
    actions: false,
    columns: {
      name: {
        filter: false,
        editor: false,
        title: this.getTranslation( 'SM_TABLE.NAME' ),
      },
    },
  };
  public pipelines = new LocalDataSource( [] as Pipeline[] );
  public userOrganizations: UserOrganization[];
  public organizationId: string;
  public pipeline: Pipeline;
  public name: string;

  public constructor(
    private usersOrganizationsService: UsersOrganizationsService,
    private pipelinesService: PipelinesService,
    private nbToastrService: NbToastrService,
    private dialogService: NbDialogService,
    translateService: TranslateService,
    private fb: FormBuilder,
    private store: Store )
  {
    super( translateService );
  }

  public async ngOnInit(): Promise<void>
  {
    await this.updateUserOrganizations();
    await this.updatePipelines();
  }

  public async updateUserOrganizations(): Promise<void> {
    const { userId } = this.store;

    await this.usersOrganizationsService
      .getAll( [ 'organization' ], { userId })
      .then( ({ items }) => {
        this.userOrganizations = items;
        this.updatePipelines();
      });
  }

  public async updatePipelines(): Promise<void> {
    const { organizationId: value } = this;
    const organizationId = value || void 0;

    await this.pipelinesService
      .find( [], { organizationId })
      .then( ({ items }) => {
        this.pipelines.load( items );
        this.filterPipelines();
      });
  }

  public deletePipeline(): void {
    this.pipelinesService
      .delete( this.pipeline.id )
      .then( () => this.updateUserOrganizations() );
  }

  public filterPipelines(): void {
    const { name: search = '' } = this;

    this.pipelines.setFilter([
      {
        field: 'name',
        search,
      },
    ]);
  }

  public async gotoForm( context: Record<any, any> ): Promise<void> {
    const dialogRef = this.dialogService.open( PipelineFormComponent, {
      context,
    });
    const data = await dialogRef.onClose.pipe( first() ).toPromise();
    const { id } = context;

    if ( data ) {
      this.nbToastrService.success(
        this.getTranslation( 'TOASTR.TITLE.SUCCESS' ),
        this.getTranslation( `TOASTR.MESSAGE.PIPELINE_${ id ? 'UPDATE' : 'CREATE' }` ) );
      await this.updateUserOrganizations();
      await this.updatePipelines();
    }
  }

}
