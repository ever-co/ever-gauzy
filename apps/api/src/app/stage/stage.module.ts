import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Stage } from './stage.entity';
import { StageService } from './stage.service';

@Module({
	imports: [TypeOrmModule.forFeature([Stage]), AuthModule],
	providers: [StageService],
	exports: [StageService]
})
export class StageModule {}
