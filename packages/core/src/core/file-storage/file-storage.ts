import { FileStorageOption, FileStorageProviderEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import * as Providers from './providers';
import { Provider } from './providers/provider';
import { RequestContext } from './../../core/context';

export class FileStorage {
	providers: { [key: string]: Provider<any> } = {};
	config: FileStorageOption = {
		dest: ''
	};

	constructor(option?: FileStorageOption) {
		this.initProvider();
		this.setConfig(option);
	}

	setConfig(config: Partial<FileStorageOption> = {}) {
		this.config = {
			...this.config,
			...config
		};
		if (isEmpty(config.provider)) {
			this.getProvider();
		}
		return this;
	}

	setProvider(providerName: FileStorageProviderEnum) {
		const providers = Object.values(FileStorageProviderEnum);
		if (isEmpty(providerName)) {
			const request = RequestContext.currentRequest();
			if (request && isNotEmpty(request['tenantSettings'])) {
				const provider = request['tenantSettings']['fileStorageProvider'] as FileStorageProviderEnum;
				if (isEmpty(provider) || !providers.includes(provider)) {
					this.config.provider = (
						environment.fileSystem.name.toUpperCase() as FileStorageProviderEnum ||
						FileStorageProviderEnum.LOCAL
					);
				} else {
					this.config.provider = provider.toUpperCase() as FileStorageProviderEnum;
				}
			} else {
				this.config.provider = (
					environment.fileSystem.name.toUpperCase() as FileStorageProviderEnum ||
					FileStorageProviderEnum.LOCAL
				);
			}
		} else {
			if (providers.includes(providerName)) {
				this.config.provider = providerName.toUpperCase() as FileStorageProviderEnum;
			} else {
				this.config.provider = FileStorageProviderEnum.LOCAL;
			}
		}
		return this;
	}

	getProvider(providerName?: FileStorageProviderEnum) {
		this.setProvider(providerName);
		return this.getProviderInstance();
	}

	storage(option?: FileStorageOption) {
		this.setConfig(option);
		if (this.config.provider && this.providers[this.config.provider]) {
			return this.providers[this.config.provider].handler(this.config);
		} else {
			const provides = Object.values(FileStorageProviderEnum).join(', ');
			throw new Error(`Provider "${this.config.provider}" is not valid. Provider must be ${provides}`);
		}
	}

	getProviderInstance(): Provider<any> {
		if (this.config.provider) {
			return this.providers[this.config.provider].getInstance();
		}
	}

	initProvider() {
		for (const key in Providers) {
			if (Object.prototype.hasOwnProperty.call(Providers, key)) {
				const className = Providers[key];
				if (className.instance === undefined) {
					const provider: Provider<any> = new className();
					this.providers[provider.name] = provider;

					className.instance = provider;
				} else {
					this.providers[className.instance.name] = className.instance;
				}
			}
		}
	}
}
