import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
   //*HABILITACIÓN DE GLOBAL PREFIX PARA LAS API
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  //*CONFIGURACIONES DE SWAGGER PARA LA DOCUMENTACIÓN API
  const config = new DocumentBuilder()
    .setTitle('Fidooo Engineering')
    .setDescription('Prueba Técnica')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1', app, document);
  
  await app.listen(process.env.PORT || 3000);
  Logger.log(`App running on port: ${process.env.PORT}`);
}
bootstrap();
