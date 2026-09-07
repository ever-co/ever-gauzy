import { IntegrationEnum } from '@gauzy/contracts';

/** Persisted names are stable; connector secrets are stored only as SHA-256 digests. */
export enum EverAsyncSettingName {
	EVER_ASYNC_SERVER_URL = 'EVER_ASYNC_SERVER_URL',
	/** Legacy scaffold setting; never used as a connector credential. */
	EVER_ASYNC_API_TOKEN = 'EVER_ASYNC_API_TOKEN',
	EVER_ASYNC_USER_MAPPINGS = 'EVER_ASYNC_USER_MAPPINGS',
	EVER_ASYNC_PROJECT_IDS = 'EVER_ASYNC_PROJECT_IDS',
	EVER_ASYNC_KEY_ID = 'EVER_ASYNC_KEY_ID',
	EVER_ASYNC_SECRET_HASH = 'EVER_ASYNC_SECRET_HASH',
	IS_ENABLED = 'IS_ENABLED'
}

export const EVER_ASYNC_INTEGRATION_NAME = IntegrationEnum.EVER_ASYNC;
