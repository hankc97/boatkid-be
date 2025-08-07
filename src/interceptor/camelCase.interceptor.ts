// case-conversion.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { camelCase, isObject, transform } from "lodash";

@Injectable()
export class CaseConversionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.convertToResponse(data)));
  }

  private convertToResponse(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.convertToResponse(item));
    }

    if (isObject(data) && !(data instanceof Date)) {
      return transform(data, (result: any, value: any, key: string) => {
        const camelKey = camelCase(key);
        result[camelKey] = this.convertToResponse(value);
      });
    }

    return data;
  }
}
