import { FileStorageOption, FileStorageProvider, FileStorageProviderEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import * as Providers from './providers';
import { Provider } from './providers/provider';
import { RequestContext } from './../../core/context';

const isDebug = false;

let debugProvider: Provider<Providers.DebugProvider>;

if (isDebug) {
	debugProvider = new Providers.DebugProvider();
}

export class FileStorage {
	providers: { [key: string]: Provider<any> } = {};
	config: FileStorageOption = {
		dest: ''
	};

	private _fileStorageProviderDefault: FileStorageProviderEnum;

	/**
	 *
	 * @param option
	 */
	constructor(option?: FileStorageOption) {
		if (!isDebug) {
			if (!this._fileStorageProviderDefault) {
				this._fileStorageProviderDefault =
					(environment.fileSystem.name.toUpperCase() as FileStorageProviderEnum) ||
					FileStorageProviderEnum.LOCAL;
			}

			this.initProvider();
			this.setConfig(option);
		} else {
			console.log('FileStorage constructor called');
		}
	}

	/**
	 * Set configuration for FileStorage.
	 * @param partialConfig - Partial configuration options.
	 * @returns Current instance of FileStorage.
	 */
	setConfig(config: Partial<FileStorageOption> = {}) {
		this.config = {
			...this.config,
			...config
		};

		// Use a more specific check for config.provider
		if (isEmpty(config.provider)) {
			this.getProvider();
		}

		return this;
	}

	/**
	 * Set the file storage provider for FileStorage.
	 * @param providerName - The name of the file storage provider.
	 * @returns Current instance of FileStorage.
	 */
	setProvider(providerName: FileStorageProvider) {
		if (!isDebug) {
			const providers = Object.values(FileStorageProviderEnum);

			if (isEmpty(providerName)) {
				const request = RequestContext.currentRequest();
				if (request && isNotEmpty(request['tenantSettings'])) {
					const provider = request['tenantSettings']['fileStorageProvider'] as FileStorageProviderEnum;
					if (isEmpty(provider) || !providers.includes(provider)) {
						this.config.provider = this._fileStorageProviderDefault;
					} else {
						this.config.provider = provider.toUpperCase() as FileStorageProviderEnum;
					}
				} else {
					this.config.provider = this._fileStorageProviderDefault;
				}
			} else {
				if (providers.includes(providerName as FileStorageProviderEnum)) {
					this.config.provider = providerName.toUpperCase() as FileStorageProviderEnum;
				} else {
					this.config.provider = FileStorageProviderEnum.LOCAL;
				}
			}
		} else {
			console.log('FileStorage setProvider called with providerName:', providerName);
		}

		return this;
	}

	/**
	 * Set the file storage provider using the specified provider name and retrieve the provider instance.
	 * @param providerName - The name of the file storage provider.
	 * @returns The file storage provider instance.
	 */
	getProvider(providerName?: FileStorageProvider) {
		this.setProvider(providerName);
		return this.getProviderInstance();
	}

	/**
	 * Create an instance of the file storage provider based on the specified options.
	 * @param option - Configuration options for file storage.
	 * @returns The file storage provider instance.
	 * @throws InvalidProviderError if the specified provider is not valid.
	 */
	storage(option?: FileStorageOption) {
		this.setConfig(option);

		if (this.config.provider && this.providers[this.config.provider]) {
			try {
				return this.providers[this.config.provider].handler(this.config);
			} catch (error) {
				console.error(`Error while get Multer file storage provider: ${error.message}`, error);
				return null;
			}
		} else {
			const providers = Object.values(FileStorageProviderEnum).join(', ');
			console.warn(`Provider "${this.config.provider}" is not valid. Provider must be ${providers}`);
			return null;
		}
	}

	/**
	 * Retrieve an instance of the file storage provider based on the current configuration.
	 * @returns The file storage provider instance.
	 * @throws Error if the specified provider is not found or if there is no provider configured.
	 */
	getProviderInstance(): Provider<any> {
		if (!isDebug) {
			if (this.config.provider && this.config.provider in this.providers) {
				return this.providers[this.config.provider].getProviderInstance();
			} else {
				const providers = Object.values(FileStorageProviderEnum).join(', ');
				console.warn(`Invalid or missing file storage provider. Valid providers are: ${providers}`);
				return null;
			}
		} else {
			console.log('FileStorage getProviderInstance called');
			return debugProvider;
		}
	}

	/**
	 * Initialize provider instances based on the Providers object.
	 */
	initProvider() {
		if (!isDebug) {
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
		} else {
			console.log('FileStorage initProvider called');
		}
	}
}
