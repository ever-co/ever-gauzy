import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ImportAllController } from './import-all.controller';
import { ImportAllService } from '.';
import { MulterModule } from '@nestjs/platform-express';

@Module({
	imports: [
		CqrsModule,
		MulterModule.register({
			dest: './import'
		})
	],
	controllers: [ImportAllController],
	providers: [ImportAllService],
	exports: [ImportAllService]
})
export class ImportAllModule {}
