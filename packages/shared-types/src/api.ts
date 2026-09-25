export interface ResponseMeta {
  requestId: string;
}

export interface PaginationMeta extends ResponseMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T, M extends ResponseMeta = ResponseMeta> {
  success: true;
  data: T;
  message: string | null;
  meta: M;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
  meta: ResponseMeta;
}

export type ApiResponse<T, M extends ResponseMeta = ResponseMeta> =
  ApiSuccess<T, M> | ApiError;
