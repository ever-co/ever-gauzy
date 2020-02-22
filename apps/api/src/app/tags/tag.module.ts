import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import { Tag } from './tag.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

@Module({
	imports: [TypeOrmModule.forFeature([Tag])],
	controllers: [TagController],
	providers: [TagService],
	exports: [TagService]
})
export class TagModule {}
