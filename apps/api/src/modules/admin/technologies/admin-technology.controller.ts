import type { Request, Response } from 'express';
import { successResponse } from '../../../common/http/response.js';
import { AppError } from '../../../common/errors/app-error.js';
import type { AccessTokens } from '../../auth/access-token.service.js';
import type {
  AdminTechnologyService,
  TechnologyAuthority,
} from './admin-technology.service.js';
import type {
  AdminTechnologyQuery,
  CreateTechnologyInput,
  PatchTechnologyInput,
} from './admin-technology.schema.js';

/** Transient verification capability: never forwards the Bearer token to persistence. */
export function technologyAuthority(
  req: Request,
  res: Response,
  tokens: Pick<AccessTokens, 'verify'>,
) {
  const abort = new AbortController();
  const lose = () => abort.abort();
  req.once('aborted', lose);
  res.once('close', lose);
  if (req.aborted || res.destroyed) lose();
  const authority: TechnologyAuthority = {
    actor: req.auth,
    signal: abort.signal,
    async verify() {
      const match =
        /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(
          req.headers.authorization ?? '',
        );
      if (!match || match[1]!.length > 4096)
        throw new AppError(
          401,
          'AUTH_ACCESS_TOKEN_INVALID',
          'Access token is invalid or expired',
        );
      return tokens.verify(match[1]!);
    },
  };
  return {
    authority,
    dispose() {
      abort.abort();
      req.removeListener('aborted', lose);
      res.removeListener('close', lose);
    },
  };
}
export function createAdminTechnologyController(
  service: AdminTechnologyService,
  tokens: Pick<AccessTokens, 'verify'>,
) {
  async function send(
    req: Request,
    res: Response,
    status: number,
    execute: (authority: TechnologyAuthority) => Promise<unknown>,
    list = false,
  ) {
    const resource = technologyAuthority(req, res, tokens);
    try {
      const value = await execute(resource.authority);
      if (resource.authority.signal?.aborted || req.aborted || res.destroyed)
        return;
      if (list) {
        const result = value as Awaited<
          ReturnType<AdminTechnologyService['list']>
        >;
        res.status(status).json({
          success: true,
          data: result.items,
          message: null,
          meta: { requestId: req.requestId, ...result.pagination },
        });
      } else res.status(status).json(successResponse(value, req.requestId));
    } finally {
      resource.dispose();
    }
  }
  return {
    list: (req: Request, res: Response, query: AdminTechnologyQuery) =>
      send(req, res, 200, (authority) => service.list(query, authority), true),
    get: (req: Request, res: Response, id: string) =>
      send(req, res, 200, (authority) => service.get(id, authority)),
    create: (req: Request, res: Response, input: CreateTechnologyInput) =>
      send(req, res, 201, (authority) => {
        const supplied = { ...input };
        if (!Object.hasOwn(req.body, 'order')) delete supplied.order;
        return service.create(supplied, req.requestId, authority);
      }),
    patch: (
      req: Request,
      res: Response,
      id: string,
      input: PatchTechnologyInput,
    ) =>
      send(req, res, 200, (authority) =>
        service.patch(id, input, req.requestId, authority),
      ),
  };
}
