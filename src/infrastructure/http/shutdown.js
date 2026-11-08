export function createShutdownHandler({ app, closeDatabase, logger = app.log }) {
  let shutdownPromise;
  return function shutdown(signal) {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      logger.info({ signal }, "Cerrando servidor");
      let failure;
      try {
        await app.close();
      } catch (error) {
        failure = error;
      }
      try {
        await closeDatabase();
      } catch (error) {
        failure = failure
          ? new AggregateError([failure, error], "Falló el cierre del servidor y de PostgreSQL.")
          : error;
      }
      if (failure) {
        logger.error({ err: failure, signal }, "El cierre del servidor terminó con errores");
        throw failure;
      }
    })();
    return shutdownPromise;
  };
}
