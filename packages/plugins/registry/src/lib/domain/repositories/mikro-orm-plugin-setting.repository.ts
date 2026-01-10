import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginSetting } from '../entities/plugin-setting.entity';

export class MikroOrmPluginSettingRepository extends MikroOrmBaseEntityRepository<PluginSetting> {}
