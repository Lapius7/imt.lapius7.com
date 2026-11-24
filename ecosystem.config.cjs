module.exports = {
  apps: [
    {
      name: "imt-lapius7",
      script: "server/index.ts",
      interpreter: "bun",
      cwd: __dirname,
      max_memory_restart: "400M",
    },
  ],
};
