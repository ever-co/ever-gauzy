import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { CandidateCriterions } from './candidate-criterions.entity';
import { CandidateCriterionsController } from './candidate-criterions.controller';
import { CandidateCriterionsService } from './candidate-criterions.service';
@Module({
	imports: [TypeOrmModule.forFeature([CandidateCriterions, User])],
	providers: [CandidateCriterionsService, UserService],
	controllers: [CandidateCriterionsController],
	exports: [CandidateCriterionsService]
})
export class CandidateCriterionsModule {}
