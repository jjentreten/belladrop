'use strict';

module.exports = {
  apps: [
    {
      name:        'ladurrie-backend',
      script:      'app.js',
      cwd:         '/var/www/ladurrie/backend',  // ajuste para o caminho na sua VPS
      instances:   1,          // aumente para 'max' se quiser cluster
      exec_mode:   'fork',
      watch:       false,
      env_production: {
        NODE_ENV:          'production',
        PORT:              3001,
      },
      // Logs
      out_file:    '/var/log/pm2/ladurrie-out.log',
      error_file:  '/var/log/pm2/ladurrie-error.log',
      merge_logs:  true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Reinicialização automática em caso de crash
      restart_delay:    3000,
      max_restarts:     10,
      min_uptime:       '10s',
    },
  ],
};
