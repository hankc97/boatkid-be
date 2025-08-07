import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class BearerTokenInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }

    const bearerToken = authHeader.split(" ")[1];

    if (!bearerToken) {
      throw new UnauthorizedException("Bearer token is missing");
    }

    if (!process.env.API_KEY) {
      throw new UnauthorizedException("API key is missing in environment");
    }

    if (bearerToken !== process.env.API_KEY) {
      throw new UnauthorizedException("Invalid token");
    }

    // Store the token in request for potential use in controllers
    request.token = bearerToken;

    return next.handle();
  }
}
