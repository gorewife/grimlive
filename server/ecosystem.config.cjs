module.exports = {
  apps: [
    {
      name: "townsquare",
      script: "index.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "750M",
      watch: false, // Disabled - was causing constant restarts
      env_file: ".env",
      env: {}
    }
  ]
};
