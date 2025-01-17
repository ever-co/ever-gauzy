import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { GauzyFiltersModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-core/shared';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { provideEffects, provideEffectsManager } from '@ngneat/effects-ng';
import { VideoEffects } from './+state/video.effect';
import { VideoQuery } from './+state/video.query';
import { VideoStore } from './+state/video.store';
import { VideoListComponent } from './features/video-list/video-list.component';
import { VideoPreviewComponent } from './features/video-preview/video-preview.component';
import { VideoComponent } from './features/video/video.component';
import { VideoPageComponent } from './pages/video-page/video-page.component';
import { VideoService } from './shared/services/video.service';
import { VideoItemComponent } from './shared/ui/video-item/video-item.component';
import { VideoPlayerComponent } from './shared/ui/video-player/video-player.component';
import { VideoUiRoutingModule } from './video-ui-routing.module';
import { VideoDetailPageComponent } from './pages/video-detail-page/video-detail-page.component';

@NgModule({
	declarations: [
		VideoListComponent,
		VideoItemComponent,
		VideoPlayerComponent,
		VideoPreviewComponent,
		VideoComponent,
		VideoPageComponent,
		VideoDetailPageComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		NoDataMessageModule,
		SharedModule,
		VideoUiRoutingModule,
		GauzyFiltersModule
	],
	providers: [provideEffectsManager(), provideEffects(VideoEffects), VideoQuery, VideoStore, VideoService]
})
export class VideoUiModule {}
