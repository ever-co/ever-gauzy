import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpResolver } from './custom-smtp.resolver';
import { CustomSmtpService } from './custom-smtp.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureModule } from '../feature/feature.module';
import { CommandHandlers } from './commands';
import { TypeOrmCustomSmtpRepository } from './repository/type-orm-custom-smtp.repository';
import { MikroOrmCustomSmtpRepository } from './repository/mikro-orm-custom-smtp.repository';

/**
 * The SMTP transport an organization's mail is sent through.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CustomSmtp]),
		MikroOrmModule.forFeature([CustomSmtp]),
		forwardRef(() => RolePermissionModule),
		CqrsModule,
		FeatureModule
	],
	controllers: [CustomSmtpController],
	providers: [
		CustomSmtpService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// service and the command bus its own module can reach, and this module is what reaches them.
		CustomSmtpResolver,
		TypeOrmCustomSmtpRepository,
		MikroOrmCustomSmtpRepository,
		...CommandHandlers
	],
	exports: [CustomSmtpService, TypeOrmCustomSmtpRepository, MikroOrmCustomSmtpRepository]
})
export class CustomSmtpModule {}