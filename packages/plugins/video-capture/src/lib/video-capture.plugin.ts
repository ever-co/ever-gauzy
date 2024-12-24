import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { VideosModule } from './videos.module';
import { Video } from './entities/video.entity';

@Plugin({
	imports: [VideosModule],
	entities: [Video],
	subscribers: [],
	providers: []
})
export class VideoCapturePlugin {}
