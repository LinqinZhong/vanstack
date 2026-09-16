import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: '  ',
});

function wantsXml(req: Request): boolean {
  if (req.query.format === 'xml') {
    return true;
  }
  const accept = req.headers.accept ?? '';
  return accept.includes('application/xml') || accept.includes('text/xml');
}

@Injectable()
export class XmlResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (!wantsXml(req) || data === undefined || data === null) {
          return data;
        }

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        const payload = Array.isArray(data) ? { items: { item: data } } : data;
        return builder.build({ response: payload });
      }),
    );
  }
}
