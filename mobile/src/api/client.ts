import type {
  Category,
  Product,
  ProductDraft,
  Settings,
  SettingsDraft,
} from './types';

/** status = 0 означает, что запрос до API не дошёл. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: string[] = [],
  ) {
    super(code);
  }

  get isOffline(): boolean {
    return this.status === 0;
  }

  /** Текст для показа пользователю: сообщения валидации, если они есть. */
  get userMessage(): string {
    if (this.isOffline) {
      return 'Сервер недоступен. Проверьте подключение и повторите.';
    }
    if (this.status === 401) {
      return 'Нужно войти заново.';
    }
    if (this.status === 404) {
      return 'Продукт не найден.';
    }
    if (this.details.length > 0) {
      return this.details.join('\n');
    }
    return 'Не удалось выполнить запрос.';
  }
}

export type ApiClient = {
  listProducts(): Promise<Product[]>;
  createProduct(draft: ProductDraft): Promise<Product>;
  updateProduct(id: string, patch: Partial<ProductDraft>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(draft: SettingsDraft): Promise<Settings>;
};

export type ApiClientOptions = {
  baseUrl: string;
  /** Возвращает Firebase ID-токен; пустая строка означает «токена нет». */
  getToken: () => Promise<string>;
};

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createApiClient({ baseUrl, getToken }: ApiClientOptions): ApiClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    if (!token) {
      throw new ApiError(401, 'unauthorized');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      });
    } catch {
      throw new ApiError(0, 'network');
    }

    if (!response.ok) {
      const body = (await parseBody(response)) as
        | { error?: string; details?: string[] }
        | null;
      throw new ApiError(
        response.status,
        body?.error ?? 'request_failed',
        body?.details ?? [],
      );
    }

    const body = await parseBody(response);
    return body as T;
  }

  return {
    listProducts: () => request<Product[]>('/products'),

    createProduct: (draft) =>
      request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(draft),
      }),

    updateProduct: (id, patch) =>
      request<Product>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),

    deleteProduct: async (id) => {
      await request<null>(`/products/${id}`, { method: 'DELETE' });
    },

    getSettings: () => request<Settings>('/settings'),

    saveSettings: (draft) =>
      request<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(draft),
      }),
  };
}

export const CATEGORY_LABELS: Record<Category, string> = {
  food: 'Продукт',
  medicine: 'Лекарство',
};
