import * as chalk from 'chalk';
import { LoggerService } from '@nestjs/common';

const DEFAULT_CONTEXT = `Bootstrap Server`;

export class DefaultLogger implements LoggerService {
  logger = console.log;

  private _defaultContext = DEFAULT_CONTEXT;
  get defaultContext() {
    return this._defaultContext;
  }
  set defaultContext(context: string) {
    this._defaultContext = context;
  }

  constructor(options?: any) {}

  log(message: any, context?: string) {
    this.printLog(chalk.green.bold(`info`), message, context);
  }

  error(message: string, context?: string, trace?: string | undefined): void {
    this.printLog(chalk.red.bold(`error`), message, context);
  }

  warn(message: string, context?: string): void {
    this.printLog(chalk.yellow.bold(`warn`), message, context);
  }

  info(message: string, context?: string): void {
    this.printLog(chalk.green.bold(`info`), message, context);
  }

  verbose(message: string, context?: string): void {
    this.printLog(chalk.green.bold(`verbose`), message, context);
  }

  debug(message: string, context?: string): void {
    this.printLog(chalk.green.bold(`debug`), message, context);
  }

  private printLog(prefix: string, message: string, context?: string) {
    this.logger([prefix, this.printContext(context), message].join(' '));
  }

  private printContext(context?: string) {
    return chalk.cyan(`[${context || this.defaultContext}]`);
  }
}
