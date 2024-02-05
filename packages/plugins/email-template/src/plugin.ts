import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { TenantModule, UserModule } from '@gauzy/core';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateSubscriber } from './email-template.subscriber';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateReaderService } from './email-template-reader.service';

/**
 * @example
 */
@CorePlugin({
	imports: [
		TypeOrmModule.forFeature([
			EmailTemplate
		]),
		MikroOrmModule.forFeature([
			EmailTemplate
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	exports: [
		EmailTemplateService,
		TypeOrmModule,
		MikroOrmModule
	],
	controllers: [
		EmailTemplateController
	],
	providers: [
		EmailTemplateService,
		EmailTemplateReaderService,
		...QueryHandlers,
		...CommandHandlers
	],
	entities: [
		EmailTemplate
	],
	subscribers: [
		EmailTemplateSubscriber
	]
})
export class EmailTemplatePlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		console.log('EmailTemplatePlugin is being bootstrapped...');
		// Your existing logic here...

		// For example, log the completion of the method.
		console.log('EmailTemplatePlugin bootstrap completed.');
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		console.log('EmailTemplatePlugin is being destroyed...');
		// Your existing logic here...

		// For example, log the completion of the method.
		console.log('EmailTemplatePlugin destruction completed.');
	}
}
