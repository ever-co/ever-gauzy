import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TermsAcceptance } from './terms-acceptance.entity';
import { TermsAcceptanceController } from './terms-acceptance.controller';
import { TermsAcceptanceService } from './terms-acceptance.service';
import { TypeOrmTermsAcceptanceRepository } from './repository/type-orm-terms-acceptance.repository';
import { MikroOrmTermsAcceptanceRepository } from './repository/mikro-orm-terms-acceptance.repository';

@Module({
	imports: [TypeOrmModule.forFeature([TermsAcceptance]), MikroOrmModule.forFeature([TermsAcceptance])],
	controllers: [TermsAcceptanceController],
	providers: [TermsAcceptanceService, TypeOrmTermsAcceptanceRepository, MikroOrmTermsAcceptanceRepository],
	exports: [TermsAcceptanceService, TypeOrmTermsAcceptanceRepository, MikroOrmTermsAcceptanceRepository]
})
export class TermsAcceptanceModule {}
