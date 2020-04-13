import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs/dist/cqrs.module';
import { CandidateCv } from './candidate-cv.entity';
import { CandidateCvService } from './candidate-cv.service';
import { CandidateCvController } from './candidate-cv.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateCv]), CqrsModule],
	providers: [CandidateCvService],
	controllers: [CandidateCvController],
	exports: [CandidateCvService]
})
export class CandidateCvModule {}
