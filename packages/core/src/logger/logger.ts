import { Logger as NestLogger, LoggerService } from '@nestjs/common';

export class Logger extends NestLogger implements LoggerService {
  private _prefix?: string | undefined;
  setPrefix(prefix: string | undefined) {
    this._prefix = prefix;
  }
  get prefix(): string | undefined {
    return this._prefix;
  }
  private static _logger: any;
  static get logger(): any {
    return this._logger;
  }
  static setLogger(logger: any) {
    Logger._logger = logger;
  }

  private static _instance: typeof Logger = Logger;
  private get instance(): typeof Logger {
    const { _instance } = Logger;
    return _instance;
  }

  log(message: string, context?: string) {
    let formattedMessage = message;
    if (this.prefix) {
      formattedMessage = `[${this.prefix}] ${message}`;
    }
    this.instance.info(formattedMessage, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.instance.error(message, trace, context);
  }

  warn(message: string, context?: string) {
    this.instance.warn(message, context);
  }

  debug(message: string, context?: string) {
    this.instance.debug(message, context);
  }

  verbose(message: string, context?: string) {
    this.instance.verbose(message, context);
  }

  static error(message: string, context?: string, trace?: string): void {
    Logger.logger.error(message, context, trace);
  }

  static warn(message: string, context?: string): void {
    Logger.logger.warn(message, context);
  }

  static info(message: string, context?: string): void {
    Logger.logger.info(message, context);
  }

  static verbose(message: string, context?: string): void {
    Logger.logger.verbose(message, context);
  }

  static debug(message: string, context?: string): void {
    Logger.logger.debug(message, context);
  }
}
