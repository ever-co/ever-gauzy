import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { VideosModule } from './videos/videos.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/plugins',
				module: PluginModule,
				children: [{ path: '/videos', module: VideosModule }]
			}
		]),
		VideosModule
	]
})
export class PluginModule { }
