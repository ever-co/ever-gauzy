import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DownloadAllController } from './download-all.controller';
import { DownloadAllService } from './download-all.service';
@Module({
	imports: [CqrsModule],
	controllers: [DownloadAllController],
	providers: [DownloadAllService],
	exports: [DownloadAllService]
})
export class DownloadAllModule {}
