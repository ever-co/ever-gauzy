import { Component, OnDestroy } from '@angular/core';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { Pipeline } from '@gauzy/models';
import { AppStore } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: './pipelines.component.html',
  selector: 'ga-pipelines',
})
export class PipelinesComponent extends TranslationBaseComponent implements OnDestroy
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
  public organizationId: string;
  public pipeline: Pipeline;
  public name: string;

  private readonly $akitaPreUpdate: AppStore[ 'akitaPreUpdate' ];

  public constructor(
    private usersOrganizationsService: UsersOrganizationsService,
    private pipelinesService: PipelinesService,
    private nbToastrService: NbToastrService,
    private dialogService: NbDialogService,
    translateService: TranslateService,
    private appStore: AppStore )
  {
    super( translateService );
    this.$akitaPreUpdate = appStore.akitaPreUpdate;
    appStore.akitaPreUpdate = ( previous, next ) => {
      if ( previous.selectedOrganization !== next.selectedOrganization ) {
        this.organizationId = next.selectedOrganization?.id;
        // noinspection JSIgnoredPromiseFromCall
        this.updatePipelines();
      }

      return this.$akitaPreUpdate( previous, next );
    };
  }

  public async ngOnDestroy(): Promise<void>
  {
    this.appStore.akitaPreUpdate = this.$akitaPreUpdate;
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

  public filterPipelines(): void {
    const { name: search = '' } = this;

    this.pipelines.setFilter([
      {
        field: 'name',
        search,
      },
    ]);
  }

  public async deletePipeline(): Promise<void> {
    await this.pipelinesService.delete( this.pipeline.id );
    await this.updatePipelines();
  }

  public async createPipeline(): Promise<void> {
    const { name, organizationId } = this;

    await this.goto({ pipeline: { name, organizationId } });
    delete this.name;
  }

  public async editPipeline(): Promise<void> {
    const { pipeline } = this;

    await this.goto({ pipeline });
    delete this.name;
  }

  private async goto( context: Record<any, any> ): Promise<void> {
    const dialogRef = this.dialogService.open( PipelineFormComponent, {
      context,
    });
    const data = await dialogRef.onClose.pipe( first() ).toPromise();
    const { id } = context;

    if ( data ) {
      this.nbToastrService.success(
        this.getTranslation( 'TOASTR.TITLE.SUCCESS' ),
        this.getTranslation( `TOASTR.MESSAGE.PIPELINE_${ id ? 'UPDATE' : 'CREATE' }` ) );
      await this.updatePipelines();
    }
  }

}
