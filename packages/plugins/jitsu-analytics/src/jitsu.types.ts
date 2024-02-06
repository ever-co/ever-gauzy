import { JitsuOptions } from "@jitsu/js";

// Provider key for Jitsu configuration
export const JITSU_MODULE_PROVIDER_CONFIG = 'JITSU_MODULE_PROVIDER_CONFIG';

// Define options for the Jitsu module
export interface JitsuModuleOptions {
    // Specifies if the Jitsu module should be global
    isGlobal?: boolean;

    // Jitsu configuration options
    config: JitsuOptions;
}
