import { IPluginConfig } from "@gauzy/common";

/**
 * 
 * @param pluginConfig 
 */
export async function runDatabaseMigrations(pluginConfig: Partial<IPluginConfig>) {
    console.log(pluginConfig);
}