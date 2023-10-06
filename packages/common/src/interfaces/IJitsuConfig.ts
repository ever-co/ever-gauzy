/**
 * Represents a configuration object for Jitsu server settings.
 */
export interface IJitsuConfig {
    /**
     * The host address of the Jitsu server.
     */
    readonly serverHost: string;

    /**
     * The write key for authenticating with the Jitsu server.
     */
    readonly serverWriteKey: string;
}
