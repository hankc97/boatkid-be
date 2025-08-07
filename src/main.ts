import { Command } from "@commander-js/extra-typings";
import { NestFactory } from "@nestjs/core";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import { consoleLoggerOptions, Log, registerLogger } from "./utils/logging";
import { getErrorMessage } from "./utils/errors";
import { ValidationPipe } from "@nestjs/common";
import { LoggingInterceptor } from "./interceptor/logging.interceptor";
import { CaseConversionInterceptor } from "./interceptor/camelCase.interceptor";
import { BearerTokenInterceptor } from "./interceptor/bearer-token.interceptor";
import { AppModule } from "./app.module";

const APP_NAME = `Boatkid`;

const bootstrap = async ({
  serverPort,
  corsOrigin = "*",
  enableShutdownHooks = true,
  isDev,
}: {
  serverPort?: number;
  corsOrigin?: string;
  enableShutdownHooks?: boolean;
  isDev?: boolean;
}) => {
  const logger = new Log("bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger,
    abortOnError: false,
  });

  // Enable CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Add global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
        strategy: "excludeAll",
      },
    })
  );

  app.useGlobalInterceptors(new LoggingInterceptor());

  // if (!isDev) {
  //   app.useGlobalInterceptors(new BearerTokenInterceptor());
  // }

  app.useGlobalInterceptors(new CaseConversionInterceptor());

  if (enableShutdownHooks) {
    app.enableShutdownHooks();
  }

  process.on("uncaughtException", async (err) => {
    logger.error(`Uncaught Exception: ${getErrorMessage(err)}`);
  });

  process.on("unhandledRejection", async (reason) => {
    logger.error(`Unhandled Rejection: ${getErrorMessage(reason)}`);
  });

  // Handle termination signals
  const signals = ["SIGTERM", "SIGINT"] as const;
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.warn(`Received ${signal} signal. Starting graceful shutdown...`);

      try {
        await app.close();
        logger.log("Application successfully closed");
        process.exit(0);
      } catch (err) {
        logger.error(`Error during graceful shutdown: ${getErrorMessage(err)}`);
        process.exit(1);
      }
    });
  });

  // Start the server
  await app.listen(serverPort);
  logger.log(`Application is running on: http://localhost:${serverPort}`);

  return app;
};

const main = async () => {
  const program = new Command()
    .name(APP_NAME)
    .description("NoChill API")
    .allowUnknownOption(true)
    .option(
      "-e, --env <file>",
      "specify the environment file to load (default: .env) - several variables may override defaults"
    )
    .option(
      "--local",
      "override env file with local environment variables (in .env.local)"
    )
    .option("--level <level>", "specify the log level (default: info)")
    .action(async (opts) => {
      let envsToLoad = [opts.env || path.join(__dirname, "..", ".env")];
      if (opts.local && !opts.env) {
        envsToLoad.push(
          ...[
            path.join(__dirname, "..", ".env.local"),
            path.join(__dirname, "..", ".env.development"),
          ]
        );
      }
      envsToLoad = envsToLoad.filter((f) => fs.existsSync(f));
      dotenv.config({ path: envsToLoad, override: true });

      const logLevel = opts.level || process.env.LOG_LEVEL || "info";
      registerLogger(
        consoleLoggerOptions(logLevel, {
          prefix: APP_NAME,
        })
      ).newLogger();

      new Log().info(
        `Loaded environment variables from ${envsToLoad.join(", ")}`
      );

      await bootstrap({
        serverPort: parseInt(process.env.PORT ?? "4000", 10),
        corsOrigin: "*",
        isDev: process.env.NODE_ENV !== "production",
      });
    });
  try {
    await program.parseAsync();
  } catch (e) {
    new Log().error(getErrorMessage(e));
    process.exit(1);
  }
};

if (require.main === module) {
  main().catch((e) => {
    new Log().error(getErrorMessage(e));
    process.exit(1);
  });
}
