export interface IJitsuConfig {
	jitsu_server_url?: string;
	jitsu_server_write_key?: string;
	jitsu_server_debug?: boolean;
	jitsu_server_echo_events?: boolean;
}

export const JITSU_CONFIG_KEYS = [
	'jitsu_server_url',
	'jitsu_server_write_key',
	'jitsu_server_debug',
	'jitsu_server_echo_events'
] as const;
