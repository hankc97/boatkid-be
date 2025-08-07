import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  CanActivate,
  UnauthorizedException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

// Custom decorator to mark endpoints as requiring server authentication
export const RequireServerAuth = () => SetMetadata("requireServerAuth", true);

// Guard to validate server bearer token
@Injectable()
export class ServerAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireAuth = this.reflector.getAllAndOverride<boolean>(
      "requireServerAuth",
      [context.getHandler(), context.getClass()]
    );

    if (!requireAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Invalid authorization header format. Expected: Bearer <token>"
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get expected token from environment
    const expectedToken = process.env.SERVER_API_TOKEN;

    if (!expectedToken) {
      throw new InternalServerErrorException("Server API token not configured");
    }

    if (token !== expectedToken) {
      throw new UnauthorizedException("Invalid server API token");
    }

    return true;
  }
}
