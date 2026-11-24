module.exports = {
  apps: [
    {
      name: "imt-lapius7",
      script: "bun",
      args: "server/index.ts",
      interpreter: "none",
      cwd: __dirname,
      max_memory_restart: "400M",
    },
  ],
};
