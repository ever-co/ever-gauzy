import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';

@Module({
	providers: [CommentService],
	controllers: [CommentController]
})
export class CommentModule {}
