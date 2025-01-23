import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GauzyFiltersModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-core/shared';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInfiniteListDirective,
	NbInputModule,
	NbListModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbSpinnerModule
} from '@nebular/theme';
import { provideEffects, provideEffectsManager } from '@ngneat/effects-ng';
import { VideoEffects } from './+state/video.effect';
import { VideoQuery } from './+state/video.query';
import { VideoStore } from './+state/video.store';
import { VideoDownloadManagerComponent } from './features/video-download-manager/video-download-manager.component';
import { VideoListComponent } from './features/video-list/video-list.component';
import { VideoComponent } from './features/video/video.component';
import { VideoDetailPageComponent } from './pages/video-detail-page/video-detail-page.component';
import { VideoPageComponent } from './pages/video-page/video-page.component';
import { DownloadQueueService } from './shared/services/download/download-queue.service';
import { FileDownloadService } from './shared/services/download/file-download.service';
import { FileSaveStrategy } from './shared/services/download/strategies/file-save.strategy';
import { VideoService } from './shared/services/video.service';
import { WebShareService } from './shared/services/web-share.service';
import { ActionButtonGroupComponent } from './shared/ui/video-actions/buttons/action-button-group/action-button-group.component';
import { ActionButtonComponent } from './shared/ui/video-actions/buttons/action-button/action-button.component';
import { VideoEditComponent } from './shared/ui/video-edit/video-edit.component';
import { VideoItemSkeletonComponent } from './shared/ui/video-item-skeleton/video-item-skeleton.component';
import { VideoItemComponent } from './shared/ui/video-item/video-item.component';
import { VideoMetadataComponent } from './shared/ui/video-metadata/video-metadata.component';
import { VideoPlayerComponent } from './shared/ui/video-player/video-player.component';
import { VideoSkeletonComponent } from './shared/ui/video-skeleton/video-skeleton.component';
import { VideoUiRoutingModule } from './video-ui-routing.module';
import { TranslateModule } from '@ngx-translate/core';
import { MomentModule } from 'ngx-moment';

@NgModule({
	declarations: [
		VideoListComponent,
		VideoItemComponent,
		VideoPlayerComponent,
		VideoComponent,
		VideoPageComponent,
		VideoDetailPageComponent,
		ActionButtonComponent,
		ActionButtonGroupComponent,
		VideoEditComponent,
		VideoMetadataComponent,
		VideoDownloadManagerComponent,
		VideoItemSkeletonComponent,
		VideoSkeletonComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		NoDataMessageModule,
		SharedModule,
		VideoUiRoutingModule,
		GauzyFiltersModule,
		NbButtonModule,
		NbPopoverModule,
		FormsModule,
		ReactiveFormsModule,
		NbDialogModule,
		NbInputModule,
		NbBadgeModule,
		NbProgressBarModule,
		NbListModule,
		MomentModule,
		TranslateModule.forChild(),
		NbSpinnerModule
	],
	providers: [
		provideEffectsManager(),
		provideEffects(VideoEffects),
		VideoQuery,
		VideoStore,
		VideoService,
		WebShareService,
		DownloadQueueService,
		FileDownloadService,
		FileSaveStrategy,
		NbInfiniteListDirective
	]
})
export class VideoUiModule {}
