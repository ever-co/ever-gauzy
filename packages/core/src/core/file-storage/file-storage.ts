import { FileStorageOption, FileStorageProviderEnum } from '@gauzy/contracts';
import * as Providers from './providers';
import { environment } from '@gauzy/config';
import { Provider } from './providers/provider';

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
			...config,
			provider: (config.provider ||
				environment.fileSystem.name) as FileStorageProviderEnum
		};
		return this;
	}

	setProvider(providerName: FileStorageProviderEnum) {
		if (providerName) {
			this.config.provider = providerName;
		}
		return this;
	}

	getProvider(providerName?: FileStorageProviderEnum) {
		this.setProvider(providerName);
		return this.getProviderInstance();
	}

	storage(option?: FileStorageOption) {
		let resp: any;
		this.setConfig(option);
		if (this.config.provider && this.providers[this.config.provider]) {
			resp = this.providers[this.config.provider].handler(this.config);
		} else {
			const provides = Object.values(FileStorageProviderEnum).join(', ');
			throw new Error(
				`Provider "${this.config.provider}" is not valid. Provider must be ${provides}`
			);
		}
		return resp;
	}

	getProviderInstance(): Provider<any> {
		return this.providers[this.config.provider].getInstance();
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
					this.providers[className.instance.name] =
						className.instance;
				}
			}
		}
	}
}
