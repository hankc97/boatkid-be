import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, originalUrl, body } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            `[${method}] ${originalUrl} ${statusCode} ${duration}ms\n` +
              `Request Body: ${JSON.stringify(body)}\n` +
              `Response: ${JSON.stringify(data)}`
          );
        },
        error: (error: any) => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          this.logger.error(
            `[${method}] ${originalUrl} ${error.status} ${duration}ms\n` +
              `Request Body: ${JSON.stringify(body)}\n` +
              `Error: ${JSON.stringify(error.message)}`
          );
        },
      })
    );
  }
}
