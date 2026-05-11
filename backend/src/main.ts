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

  const corsEntries = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && corsEntries.length === 0) {
    throw new Error(
      'CORS_ORIGIN must be set in production (comma-separated list of allowed origins; supports /regex/ syntax).'
    );
  }

  // Entries wrapped in /.../ are treated as regex (useful for *.vercel.app preview URLs).
  const exactOrigins: string[] = [];
  const regexOrigins: RegExp[] = [];
  for (const entry of corsEntries) {
    if (entry.startsWith('/') && entry.lastIndexOf('/') > 0) {
      const lastSlash = entry.lastIndexOf('/');
      const pattern = entry.slice(1, lastSlash);
      const flags = entry.slice(lastSlash + 1);
      regexOrigins.push(new RegExp(pattern, flags));
    } else {
      exactOrigins.push(entry);
    }
  }

  app.enableCors({
    origin: corsEntries.length === 0
      ? true
      : (origin, callback) => {
          // Allow same-origin / curl / server-to-server (no Origin header)
          if (!origin) return callback(null, true);
          if (exactOrigins.includes(origin)) return callback(null, true);
          if (regexOrigins.some((rx) => rx.test(origin))) return callback(null, true);
          return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
        },
    credentials: true
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  console.log(`E-QRAS backend listening on http://localhost:${port}`);
}

bootstrap();
