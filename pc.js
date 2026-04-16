const si = require("systeminformation");

async function getFullInfo() {
  const cpu = await si.cpu();
  const load = await si.currentLoad();
  const mem = await si.mem();
  const memLayout = await si.memLayout();
  const disk = await si.fsSize();
  const os = await si.osInfo();
  const time = await si.time();

  return {
    cpu: {
      name: cpu.manufacturer + " " + cpu.brand,
      cores: cpu.cores,
      threads: cpu.physicalCores,
      usage: load.currentLoad.toFixed(1)
    },

    ram: {
      total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
      used: (mem.used / 1024 / 1024 / 1024).toFixed(2),
      slots: memLayout.length
    },

    disk: disk.map(d => ({
      name: d.fs,
      used: (d.used / 1024 / 1024 / 1024).toFixed(2),
      total: (d.size / 1024 / 1024 / 1024).toFixed(2)
    })),

    os: {
      distro: os.distro,
      arch: os.arch
    },

    uptime: (time.uptime / 3600).toFixed(1) + "h"
  };
}

module.exports = { getFullInfo };