import {
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { JoinColumn, Relation, RelationId } from 'typeorm';
import { IPlugin } from '../../shared/models/plugin.model';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';
import { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import { Plugin } from './plugin.entity';

@MultiORMEntity('plugin_tenants')
export class PluginTenant extends TenantOrganizationBaseEntity implements IPluginTenant {
	@ApiProperty({ description: 'Status of the plugin' })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	enabled: boolean;

	@ApiProperty({ enum: PluginScope, description: 'Scope of the plugin' })
	@IsEnum(PluginScope, { message: 'Invalid plugin scope' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginScope, default: PluginScope.TENANT })
	scope: PluginScope;

	@MultiORMColumn({ type: 'uuid' })
	@RelationId((pluginTenant: PluginTenant) => pluginTenant.plugin)
	pluginId: string;

	// Define relation with Plugin entity
	@MultiORMManyToOne(() => Plugin, { onDelete: 'CASCADE' })
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Settings relationships - settings specific to this plugin tenant
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin settings for this tenant' })
	@MultiORMOneToMany('PluginSetting', 'pluginTenant', {
		onDelete: 'CASCADE'
	})
	settings?: IPluginSetting[];

	/*
	 * Plugin Subscriptions relationships - subscriptions for this plugin tenant
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Plugin subscriptions for this tenant' })
	@MultiORMOneToMany('PluginSubscription', 'pluginTenant', {
		onDelete: 'CASCADE'
	})
	subscriptions?: IPluginSubscription[];
}
