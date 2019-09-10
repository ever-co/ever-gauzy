/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 **/

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const options = new DocumentBuilder()
    .setTitle('Gauzy controllers')
    .setVersion('1.0')
    .setBasePath('api/')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('swg', app, document);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.port || 3000;
  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/' + globalPrefix);
  });
}

bootstrap();
