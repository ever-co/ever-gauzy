import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../comment.entity';

@Injectable()
export class TypeOrmCommentRepository extends Repository<Comment> {
	constructor(@InjectRepository(Comment) readonly repository: Repository<Comment>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
