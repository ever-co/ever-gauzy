import { ProductCreateHandler } from './product.create.handler';
import { ProductUpdateHandler } from './product.update.handler';
import { ProductDeleteHandler } from './product.delete.handler';

export const CommandHandlers = [
	ProductCreateHandler,
	ProductUpdateHandler,
	ProductDeleteHandler
];
