/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Format, TransformableInfo } from "logform";
import { blue, cyan, green, inverse, magenta, red, yellow } from "picocolors";
import { SPLAT } from "triple-beam";
import { inspect } from "util";
import {
  LeveledLogMethod,
  LoggerOptions,
  Logger as NativeWinstonLogger,
  createLogger,
  format,
  transports,
} from "winston";
import { repr } from "./misc";
import { isDefined } from "./assert";

export const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || "info";
const VALID_LOG_LEVELS = new RegExp(
  "debug|error|info|warn|log|silly|verbose|fatal"
);
export type LogLevel =
  | "debug"
  | "error"
  | "info"
  | "warn"
  | "log"
  | "silly"
  | "verbose"
  | "fatal";

interface CustomLogDetails {
  pid: number;
  level: string;
  timestamp: string;
  message: string;
  context?: string;
  logName?: string;
  meta?: string;
}

const transformLog = (info: TransformableInfo): CustomLogDetails => {
  const splat = info[SPLAT];
  const context = info.context
    ? repr(info.context)
    : Array.isArray(splat)
    ? splat.filter((u) => typeof u === "string" && u).join(":")
    : undefined;
  return {
    pid: process.pid,
    level: info.level.toUpperCase(),
    message:
      typeof info.message === "string"
        ? info.message
        : info.message
        ? repr(info.message)
        : "",
    context: context || undefined,
    meta:
      isDefined(info.meta) &&
      Object.keys(info.meta as Record<string, unknown>).length
        ? inspect(info.meta)
        : undefined,
    timestamp: repr(info.timestamp),
  };
};

const LEVEL_COLORS: {
  [k: string]: (input: string | number | null | undefined) => string;
} = {
  debug: magenta,
  log: green,
  warn: yellow,
  error: red,
  verbose: cyan,
  silly: inverse,
};

export const consoleLogFormat = (prefix?: string): Format =>
  format.printf((info: TransformableInfo): string => {
    const color = LEVEL_COLORS[info.level] ?? green;
    const details = transformLog(info);
    const context = details.context ? `[${cyan(details.context)}] ` : "";
    const meta = details.meta ? `\t${magenta(details.meta)}` : "";
    const logPrefix = prefix ? `[${green(prefix)}] ` : "";
    return `${logPrefix}[${blue(details.pid)}] [${yellow(
      details.timestamp
    )}] ${context}[${color(details.level)}] ${color(details.message)}${meta}`;
  });

export const simpleLogFormat = (prefix?: string): Format =>
  format.printf((info: TransformableInfo): string => {
    const color = LEVEL_COLORS[info.level] ?? green;
    const logPrefix = prefix ? `${prefix} ` : "";
    return `${logPrefix}${color(info.message ? repr(info.message) : "")}`;
  });

export const parseLogLevel = (logLevel?: string): LogLevel => {
  let level = (logLevel ?? DEFAULT_LOG_LEVEL).trim().toLowerCase();
  // map a nest-supported level to winston
  if (level === "log" || !VALID_LOG_LEVELS.test(level)) {
    level = DEFAULT_LOG_LEVEL;
  }
  return level as LogLevel;
};

export const consoleLoggerOptions = (
  logLevel: string = DEFAULT_LOG_LEVEL,
  options?: { prefix?: string; format?: Format }
): LoggerOptions => ({
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  exitOnError: false,
  transports: [
    new transports.Console({
      format:
        options?.format ??
        format.combine(format.timestamp(), consoleLogFormat(options?.prefix)),
    }),
  ],
  level: parseLogLevel(logLevel),
});

export type LogCallback = () => string;

export interface Logger {
  error(message: unknown, ...meta: any[]): Logger;

  debug(messageOrCallback: string | LogCallback, ...meta: any[]): Logger;

  log(message: string, ...meta: any[]): Logger;

  warn(message: string, ...meta: any[]): Logger;

  info(message: string, ...meta: any[]): Logger;

  silly(messageOrCallback: string | LogCallback, ...meta: any[]): Logger;

  verbose(messageOrCallback: string | LogCallback, ...meta: any[]): Logger;
}

export interface LogFactory {
  newLogger(name?: string): Logger | undefined;
}

const logFactories: LogFactory[] = [];

export const registerLogger = (
  factoryOrLogger: LogFactory | LoggerOptions
): LogFactory => {
  let factory: LogFactory | undefined;
  if ((factoryOrLogger as LogFactory).newLogger) {
    factory = factoryOrLogger as LogFactory;
  } else {
    const logger = new WinstonLogger(factoryOrLogger as LoggerOptions);
    factory = new (class implements LogFactory {
      public newLogger(): Logger {
        return logger;
      }
    })();
  }
  // newest takes precedence
  logFactories.unshift(factory);
  return factory;
};

export const unregisterLogger = (factory: LogFactory): void => {
  const index = logFactories.indexOf(factory);
  if (index >= 0) {
    logFactories.splice(index, 1);
  }
};

export const ConsoleLogger: Logger = createLogger(consoleLoggerOptions());

const newLogger = (name?: string): Logger => {
  for (const logFactory of logFactories) {
    const maybeLogger = logFactory.newLogger(name);
    if (isDefined(maybeLogger)) {
      return maybeLogger;
    }
  }
  return ConsoleLogger;
};

class WinstonLogger implements Logger {
  private readonly logger: NativeWinstonLogger;
  constructor(options: LoggerOptions) {
    this.logger = createLogger(options);
  }

  public debug(
    messageOrCallback: string | LogCallback,
    ...meta: any[]
  ): Logger {
    return this.maybeLog(
      messageOrCallback,
      meta,
      this.logger.debug,
      "debug",
      "verbose",
      "silly"
    );
  }

  public log(message: string, ...meta: any[]): Logger {
    this.logger.info(message, ...meta);
    return this;
  }
  public warn(message: string, ...meta: any[]): Logger {
    this.logger.warn(message, ...meta);
    return this;
  }
  public info(message: string, ...meta: any[]): Logger {
    this.logger.info(message, ...meta);
    return this;
  }

  public silly(
    messageOrCallback: string | LogCallback,
    ...meta: any[]
  ): Logger {
    return this.maybeLog(messageOrCallback, meta, this.logger.silly, "silly");
  }

  public verbose(
    messageOrCallback: string | LogCallback,
    ...meta: any[]
  ): Logger {
    return this.maybeLog(
      messageOrCallback,
      meta,
      this.logger.verbose,
      "verbose",
      "silly"
    );
  }

  public error(message: unknown, ...meta: any[]): Logger {
    this.logger.error(repr(message), ...meta);
    return this;
  }

  private maybeLog(
    messageOrCallback: string | LogCallback,
    meta: any[],
    logMethod: LeveledLogMethod,
    ...logLevels: string[]
  ) {
    if (typeof messageOrCallback === "function") {
      if (logLevels.includes(this.logger.level)) {
        const message = messageOrCallback();
        logMethod(message, ...meta);
      }
    } else {
      logMethod(messageOrCallback, ...meta);
    }
    return this;
  }
}

// designed to act as a lazy logger - proxying at runtime
export class Log implements Logger {
  private internalLogger: Logger | undefined;

  constructor(private readonly name?: string) {}

  private get logger(): Logger {
    if (!isDefined(this.internalLogger)) {
      this.internalLogger = newLogger(this.name);
    }
    return this.internalLogger;
  }

  public debug(
    messageOrCallback: string | LogCallback,
    ...meta: any[]
  ): Logger {
    this.logger.debug(messageOrCallback, this.name, ...meta);
    return this;
  }

  public error(message: unknown, ...meta: any[]): Logger {
    this.logger.error(message, this.name, ...meta);
    return this;
  }

  public info(message: string, ...meta: any[]): Logger {
    this.logger.info(message, this.name, ...meta);
    return this;
  }

  public log(message: string, ...meta: any[]): Logger {
    return this.info(message, ...meta);
  }

  public warn(message: string, ...meta: any[]): Logger {
    this.logger.warn(message, this.name, ...meta);
    return this;
  }

  public silly(
    messageOrCallback: string | LogCallback,
    ...meta: any[]
  ): Logger {
    this.logger.silly(messageOrCallback, this.name, ...meta);
    return this;
  }

  public verbose(
    messageOrCallback: string | LogCallback,
    ...meta: any[]
  ): Logger {
    this.logger.verbose(messageOrCallback, this.name, ...meta);
    return this;
  }
}
