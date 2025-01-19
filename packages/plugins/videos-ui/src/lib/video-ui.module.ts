import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { GauzyFiltersModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-core/shared';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule
} from '@nebular/theme';
import { provideEffects, provideEffectsManager } from '@ngneat/effects-ng';
import { VideoEffects } from './+state/video.effect';
import { VideoQuery } from './+state/video.query';
import { VideoStore } from './+state/video.store';
import { VideoListComponent } from './features/video-list/video-list.component';
import { VideoPreviewComponent } from './features/video-preview/video-preview.component';
import { VideoComponent } from './features/video/video.component';
import { VideoDetailPageComponent } from './pages/video-detail-page/video-detail-page.component';
import { VideoPageComponent } from './pages/video-page/video-page.component';
import { VideoService } from './shared/services/video.service';
import { ActionButtonGroupComponent } from './shared/ui/video-actions/buttons/action-button-group/action-button-group.component';
import { ActionButtonComponent } from './shared/ui/video-actions/buttons/action-button/action-button.component';
import { VideoItemComponent } from './shared/ui/video-item/video-item.component';
import { VideoPlayerComponent } from './shared/ui/video-player/video-player.component';
import { VideoUiRoutingModule } from './video-ui-routing.module';
import { VideoEditComponent } from './shared/ui/video-edit/video-edit.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
	declarations: [
		VideoListComponent,
		VideoItemComponent,
		VideoPlayerComponent,
		VideoPreviewComponent,
		VideoComponent,
		VideoPageComponent,
		VideoDetailPageComponent,
		ActionButtonComponent,
		ActionButtonGroupComponent,
		VideoEditComponent
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
		NbInputModule
	],
	providers: [provideEffectsManager(), provideEffects(VideoEffects), VideoQuery, VideoStore, VideoService]
})
export class VideoUiModule {}
