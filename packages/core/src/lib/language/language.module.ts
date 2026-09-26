import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LanguageService } from './language.service';
import { LanguageController } from './language.controller';
import { LanguageResolver } from './language.resolver';
import { Language } from './language.entity';
import { TypeOrmLanguageRepository } from './repository/type-orm-language.repository';
import { MikroOrmLanguageRepository } from './repository/mikro-orm-language.repository';

/**
 * The platform's language master.
 *
 * The resolver is declared here, beside the service it calls: a resolver is an ordinary Nest provider
 * and can only inject what the module hosting it can reach. It adds one provider and no import — the
 * only dependency beyond the service is the capability gate, and both of that guard's own
 * dependencies are global: the cache the resolved flag is held in, and the feature service the flag
 * is resolved from.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Language]), MikroOrmModule.forFeature([Language])],
	controllers: [LanguageController],
	providers: [
		LanguageService,
		// The GraphQL view of the same resource.
		LanguageResolver,
		TypeOrmLanguageRepository,
		MikroOrmLanguageRepository
	],
	exports: [LanguageService]
})
export class LanguageModule {}