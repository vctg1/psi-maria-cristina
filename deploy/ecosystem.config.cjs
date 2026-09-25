module.exports = {
  apps: [
    {
      name: 'psi-maria-cristina',
      cwd: '/opt/psi/app',
      script: '/opt/psi/app/node_modules/next/dist/bin/next',
      args: 'start --hostname 127.0.0.1 --port 3010',
      interpreter: '/root/.nvm/versions/node/v24.18.1/bin/node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
