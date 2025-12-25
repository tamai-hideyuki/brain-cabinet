/**
 * 認証付きAPIクライアント
 * Clerkのトークンを自動的にAuthorizationヘッダーに付与する
 */

type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;
let resolveTokenGetter: (() => void) | null = null;

// トークン取得関数が設定されるまで待機するためのPromise
const tokenGetterPromise = new Promise<void>((resolve) => {
  resolveTokenGetter = resolve;
});

/**
 * トークン取得関数を設定
 * アプリ起動時に一度だけ呼び出す
 */
export const setTokenGetter = (getter: TokenGetter) => {
  getToken = getter;
  if (resolveTokenGetter) {
    resolveTokenGetter();
  }
};

/**
 * 認証付きfetch
 * Authorizationヘッダーにトークンを付与してリクエストを送信
 */
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // トークン取得関数が設定されるまで待機
  if (!getToken) {
    await tokenGetterPromise;
  }

  const headers = new Headers(options.headers);

  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
};
