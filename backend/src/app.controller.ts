import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      message: 'E-QRAS backend is running.',
      frontend: 'http://localhost:3000',
      apiBase: '/api'
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok'
    };
  }

  @Get('health/ready')
  ready() {
    return {
      status: 'ready',
      ts: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    };
  }
}
