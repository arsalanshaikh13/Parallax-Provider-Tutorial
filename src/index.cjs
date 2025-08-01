// use dyanmic import() to get the ES module's exports.
// const esModule = await import('./index.mjs');
// module.exports = esModule.default || esModule;

// we export a promise that resolves with the module exports
// this is  the cleanes way to do this in a cjs context without top-level await
module.exports = (async () => {
  const esModule = await import('./index.mjs');
  return esModule.default || esModule;
})();
