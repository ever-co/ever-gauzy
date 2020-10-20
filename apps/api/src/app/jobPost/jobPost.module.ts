import { JobPostService } from './jobPost.service';
import { JobPostController } from './jobPost.controller';
import { JobPost } from './jobPost.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';

@Module({
	imports: [TypeOrmModule.forFeature([JobPost]), UserModule],
	controllers: [JobPostController],
	providers: [JobPostService],
	exports: [JobPostService]
})
export class JobPostModule {}
