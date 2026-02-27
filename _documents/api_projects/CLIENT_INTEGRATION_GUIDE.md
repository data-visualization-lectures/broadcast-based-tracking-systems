# クライアントアプリ（svg-tectures等）実装ガイド：サブドメイン認証共有

`auth.dataviz.jp` で確立された認証セッションを、`svg-tectures.dataviz.jp` などのサブドメインアプリケーションで共有・利用するための実装必須要件です。

## 概要

認証基盤（`dataviz-auth`）は、以下の設定でセッションクッキーを発行しています。クライアントアプリ側でも、Supabaseクライアントを初期化する際に**全く同じ設定**を使用する必要があります。設定が一つでも異なると、クッキーが見つからずログイン状態になりません。

## 必須設定パラメータ

| パラメータ | 設定値 (必須) | 理由 |
| :--- | :--- | :--- |
| **`domain`** | **`.dataviz.jp`** | サブドメイン間で共有するため（先頭のドットが重要） |
| **`name`** | **`sb-dataviz-auth-token`** | デフォルト以外の固定名を使用しているため |
| **`sameSite`** | **`none`** | クロスサブドメイン（auth ⇔ client）でのクッキー送信を許可するため |
| **`secure`** | **`true`** | `SameSite=None` には必須 |
| **`httpOnly`** | **`false`** | クライアントサイドJSからセッションを読むため |

---

## 実装コード例 (Next.js App Router / @supabase/ssr)

`lib/supabase/client.ts` (またはそれに準ずるファイル) で、`createBrowserClient` を以下のように修正してください。

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        // ▼▼▼ 必須設定 ▼▼▼
        domain: ".dataviz.jp",
        name: "sb-dataviz-auth-token",
        sameSite: "none",
        secure: true,
        httpOnly: false,
        // ▲▲▲ 必須設定 ▲▲▲
      },
    }
  );
}
```

サーバーコンポーネント用 (`createServerClient`) の設定も同様です：

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
           // ... (通常の実装) ...
        },
      },
      // ▼▼▼ 必須設定 ▼▼▼
      cookieOptions: {
        domain: ".dataviz.jp",
        name: "sb-dataviz-auth-token",
        sameSite: "none",
        secure: true,
        httpOnly: false,
      },
      // ▲▲▲ 必須設定 ▲▲▲
    }
  );
}
```

## トラブルシューティング

### Q. クッキーは見えているのに `auth.getUser()` が null を返す
**A.** `name` プロパティが一致していない可能性が高いです。ブラウザの開発者ツールで、`.dataviz.jp` ドメインに `sb-dataviz-auth-token` という名前のクッキーがあるか確認し、クライアント側のコードでもその名前を指定しているか再確認してください。

### Q. `SameSite=Lax` ではだめですか？
**A.** だめです。`auth.dataviz.jp` と `svg-tectures.dataviz.jp` はブラウザにとって別サイト扱いとなるケースがあり、`Lax` だと認証後のリダイレクトバック時や、非同期フェッチ時にクッキーが送信されません。

### Q. `HttpOnly=true` にできないのですか？
**A.** セキュリティ上は望ましいですが、現状のクライアントアプリの設計（ブラウザJSから直接セッションを参照する）上、`false` にする必要があります。`true` にすると、サーバーサイド（SSR）では読めますが、ブラウザ (`createBrowserClient`) からは見えなくなります。
