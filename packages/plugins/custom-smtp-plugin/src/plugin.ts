import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { TenantModule, UserModule } from '@gauzy/core';
import { CommandHandlers } from './commands';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { CustomSmtpSubscriber } from './custom-smtp.subscriber';

/**
 * @example
 */
@CorePlugin({
	imports: [
		TypeOrmModule.forFeature([
			CustomSmtp
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	exports: [
		CustomSmtpService,
		TypeOrmModule,
		MikroOrmModule
	],
	controllers: [
		CustomSmtpController
	],
	providers: [
		CustomSmtpService,
		...CommandHandlers
	],
	entities: [
		CustomSmtp
	],
	subscribers: [
		CustomSmtpSubscriber
	]
})
export class CustomSmtpPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		console.log('CustomSmtpPlugin is being bootstrapped...');
		// Your existing logic here...

		// For example, log the completion of the method.
		console.log('CustomSmtpPlugin bootstrap completed.');
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		console.log('CustomSmtpPlugin is being destroyed...');
		// Your existing logic here...

		// For example, log the completion of the method.
		console.log('CustomSmtpPlugin destruction completed.');
	}
}
