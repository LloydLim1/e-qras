import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  );

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGIN must be set in production (comma-separated list of allowed origins).'
    );
  }

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  console.log(`E-QRAS backend listening on http://localhost:${port}`);
}

bootstrap();
