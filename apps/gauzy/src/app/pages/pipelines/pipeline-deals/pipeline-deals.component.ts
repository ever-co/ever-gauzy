import { Component, OnInit } from '@angular/core';
import { Deal, Pipeline } from '@gauzy/models';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import { ActivatedRoute } from '@angular/router';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { PipelineDealExcerptComponent } from './pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DealsService } from '../../../@core/services/deals.service';

@Component( {
  templateUrl: './pipeline-deals.component.html',
  selector: 'ga-pipeline-deals',
} )
export class PipelineDealsComponent extends TranslationBaseComponent implements OnInit
{

  public deals = new LocalDataSource( [] as Deal[] );

  public readonly smartTableSettings = {
    actions: false,
    noDataMessage: '-',
    columns: {
      title: {
        filter: false,
        editor: false,
        title: 'title',
      },
      stage: {
        filter: false,
        editor: false,
        title: 'Stage',
        type: 'custom',
        renderComponent: PipelineDealExcerptComponent,
      },
    },
  };

  public pipeline: Pipeline;

  public stageId: string;

  public deal: Deal;

  public constructor(
    translateService: TranslateService,
    private dealsService: DealsService,
    private dialogService: NbDialogService,
    private activatedRoute: ActivatedRoute,
    private pipelinesService: PipelinesService )
  {
    super( translateService );
  }

  public ngOnInit(): void
  {
    this.updateViewData();
    this.smartTableSettings.noDataMessage = this.getTranslation( 'SM_TABLE.NO_RESULT' );
    this.smartTableSettings.columns.title.title = this.getTranslation( 'SM_TABLE.TITLE' );
    this.smartTableSettings.columns.stage.title = this.getTranslation( 'SM_TABLE.STAGE' );
  }

  public filterDealsByStage(): void
  {
    setTimeout( () =>
    {
      const { stageId: search = '' } = this;

      this.deals.setFilter( [
        {
          field: 'stageId',
          search,
        },
      ] );
    } );
  }

  public async deleteDeal(): Promise<void>
  {
    const canProceed: 'ok' = await this.dialogService
      .open( DeleteConfirmationComponent, {
        context: {
          recordType: this.getTranslation(
            'PIPELINE_DEALS_PAGE.RECORD_TYPE',
            this.deal,
          ),
        },
      } )
      .onClose.toPromise();

    if ( 'ok' === canProceed ) {
      await this.dealsService.delete( this.deal.id );
      this.updateViewData();
      delete this.deal;
    }
  }

  private updateViewData(): void
  {
    this.activatedRoute.params
      .subscribe( async ( { pipelineId } ) =>
      {
        await this.pipelinesService.find( [ 'stages' ], {
          id: pipelineId,
        } ).then( ( { items: [ value ] } ) => this.pipeline = value );

        await this.pipelinesService.findDeals( pipelineId )
          .then( ( { items } ) =>
          {
            items.forEach( deal =>
              deal.stage = this.pipeline.stages
                .find( ( { id } ) => id === deal.stageId ) );
            this.deals.load( items );
            this.filterDealsByStage();
          } );
      } );
  }
}
