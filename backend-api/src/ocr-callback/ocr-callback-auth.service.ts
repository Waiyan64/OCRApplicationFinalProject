import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { IncomingHttpHeaders } from 'http';

export type OcrAuthMethod = 'bearer' | 'hmac' | 'none';

@Injectable()
export class OcrCallbackAuthService {
    private readonly logger = new Logger(OcrCallbackAuthService.name);

    verifyRequest(rawBody: Buffer, headers: IncomingHttpHeaders): OcrAuthMethod {
        const expectedToken = (process.env.OCR_CALLBACK_AUTH_TOKEN ?? '').trim();
        const hmacSecret = (process.env.OCR_CALLBACK_HMAC_SECRET ?? '').trim();

        if (!expectedToken && !hmacSecret) {
            this.logger.warn(
                'OCR callback endpoint is running without authentication. Set OCR_CALLBACK_AUTH_TOKEN or OCR_CALLBACK_HMAC_SECRET.',
            );
            return 'none';
        }

        const authorization = this.getHeader(headers, 'authorization');
        if (expectedToken && this.verifyBearerToken(authorization, expectedToken)) {
            return 'bearer';
        }

        const timestamp = this.getHeader(headers, 'x-ocr-timestamp');
        const signature = this.getHeader(headers, 'x-ocr-signature');
        if (hmacSecret && this.verifyHmac(rawBody, timestamp, signature, hmacSecret)) {
            return 'hmac';
        }

        throw new UnauthorizedException('Invalid OCR callback authentication.');
    }

    private verifyBearerToken(
        authorizationHeader: string | undefined,
        expectedToken: string,
    ): boolean {
        if (!authorizationHeader) {
            return false;
        }

        const [scheme, token] = authorizationHeader.split(' ');
        if (!scheme || !token) {
            return false;
        }

        if (scheme.toLowerCase() !== 'bearer') {
            return false;
        }

        return this.safeCompare(token, expectedToken);
    }

    private verifyHmac(
        rawBody: Buffer,
        timestampHeader: string | undefined,
        signatureHeader: string | undefined,
        secret: string,
    ): boolean {
        if (!timestampHeader || !signatureHeader) {
            return false;
        }

        const timestamp = Number(timestampHeader);
        if (!Number.isFinite(timestamp)) {
            return false;
        }

        const maxSkew = Number(process.env.OCR_CALLBACK_MAX_SKEW_SECONDS ?? 300);
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > maxSkew) {
            this.logger.warn(
                `Rejecting callback due to timestamp skew. now=${now} ts=${timestamp} maxSkew=${maxSkew}`,
            );
            return false;
        }

        const signedPayload = Buffer.concat([
            Buffer.from(`${timestampHeader}.`, 'utf-8'),
            rawBody,
        ]);

        const expectedHex = createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        return this.safeCompare(signatureHeader, expectedHex);
    }

    private getHeader(
        headers: IncomingHttpHeaders,
        name: string,
    ): string | undefined {
        const value = headers[name.toLowerCase() as keyof IncomingHttpHeaders];
        if (Array.isArray(value)) {
            return value[0];
        }
        return typeof value === 'string' ? value : undefined;
    }

    private safeCompare(a: string, b: string): boolean {
        const aBuf = Buffer.from(a, 'utf-8');
        const bBuf = Buffer.from(b, 'utf-8');
        if (aBuf.length !== bBuf.length) {
            return false;
        }
        return timingSafeEqual(aBuf, bBuf);
    }
}
