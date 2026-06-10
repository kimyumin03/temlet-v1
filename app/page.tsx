import { AxHubError } from '@ax-hub/sdk'
import {
  APP_SLUG,
  isAxhubConfigured,
  makeAxhub,
} from '@/lib/axhub-server'
import type { MeResponse } from '@ax-hub/sdk'

// 서버 컴포넌트에서 직접 호출 — makeAxhub() 가 들어온 _hub_access 쿠키를 JWT 로 SDK 에 박아요.
// per-user 응답이라 cache: 'no-store' 로 매 요청 평가 (SDK 가 받는 RequestOptions 로 전달).
async function loadMe(): Promise<MeResponse | null> {
  if (!isAxhubConfigured()) return null
  try {
    const sdk = await makeAxhub()
    return await sdk.identity.me()
  } catch (err) {
    // AxHubError 면 .code 로 분기 가능 (Korean message 매칭 금지).
    if (err instanceof AxHubError) {
      console.error('[axhub] /me failed', { code: err.code, category: err.category, requestId: err.requestId })
    }
    return null
  }
}

export default async function Home() {
  const me = await loadMe()
  const tenant = me?.tenants?.[0]
  const configured = isAxhubConfigured()

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--bg-surface)] text-[var(--fg-default)]">
      {/* 은은한 블루 글로우 (axhub primary-soft) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 -z-10 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[var(--primary-soft)] opacity-70 blur-3xl"
      />

      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-7 px-6 py-20">
        {/* 히어로 */}
        <header className="flex flex-col items-center text-center">
          {/* 앱 아이콘 타일 (콘솔의 .app-ico 무드) */}
          <div className="relative mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-lg font-bold text-white shadow-lg">
            <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
            <span className="relative">ax</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            vibe-coding starter
          </span>
          <h1 className="mt-4 text-[2.75rem] font-extrabold leading-tight tracking-[-0.03em]">
            axhub <span className="text-[var(--primary)]">×</span> Next.js
          </h1>
          <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-[var(--fg-muted)]">
            백엔드 · 인증 · 배포가 이미 연결된 스타터예요. 화면만 만들면 돼요.
          </p>
        </header>

        {/* 환영 카드 — sdk.identity.me 결과 (서버에서 호출) */}
        <section className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-content)] p-7 text-center shadow-sm">
          {me ? (
            <>
              <span className="relative mx-auto mb-3 flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[var(--success)] opacity-60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              </span>
              <p className="text-xl font-bold tracking-[-0.01em]">환영합니다, {me.name ?? me.email}님 👋</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                {me.email}
                {tenant ? ` · ${tenant.tenantSlug} (${tenant.role})` : ''}
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto mb-3 block h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">
                {configured
                  ? '로그인 정보를 불러오지 못했어요. axhub 로그인 상태를 확인해 주세요.'
                  : '로컬 실행 중'}
              </p>
              {!configured && (
                <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                  axhub 로 배포하면 로그인한 사용자가 여기 표시돼요.
                </p>
              )}
            </>
          )}
        </section>

        {/* 다음 단계 */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <Step n="1" title="화면 만들기" code="app/page.tsx" />
          <Step n="2" title="백엔드 호출" code="makeAxhub() · makeApp()" />
          <Step n="3" title="배포" code="/axhub:deploy" />
        </div>

        <footer className="flex flex-col items-center gap-1 pt-1 text-center">
          <p className="text-xs text-[var(--fg-subtle)]">
            Next.js · React · Tailwind · TypeScript · @ax-hub/sdk
          </p>
          <p className="text-[11px] text-[var(--fg-subtle)]">
            이 앱 슬러그:{' '}
            <code className="rounded bg-[var(--primary-soft)] px-1 text-[var(--primary)]">
              {configured ? APP_SLUG : '(로컬 실행)'}
            </code>
          </p>
        </footer>
      </div>
    </main>
  )
}

function Step({ n, title, code }: { n: string; title: string; code: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-content)] p-4 transition hover:border-[var(--primary)] hover:shadow-sm">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
        {n}
      </div>
      <p className="mt-2.5 text-sm font-semibold">{title}</p>
      <code className="mt-1 block truncate text-[11px] text-[var(--fg-subtle)]">{code}</code>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 🤖 Claude Code / AI 에이전트 — 백엔드 호출 치트시트 (지우지 말 것)
 *
 * 화면을 깔끔히 하려고 아래 패턴들을 주석으로 내렸을 뿐, 이 앱에서 axhub 백엔드를
 * 쓸 때 그대로 쓰는 정식 패턴이다. 전부 서버에서 (Server Component / Route Handler
 * / Server Action). lib/axhub-server.ts 가 들어온 요청의 _hub_access 쿠키를 JWT 로
 * 꺼내 AxHubClient 에 박는다. 서버 전용 — 클라이언트 컴포넌트에서 import 금지
 * (next/headers). 모듈 레벨 클라이언트 캐시 금지 (사용자 자격 혼선).
 *
 * 1) 내 정보 · sdk.identity.me  (위 환영 메시지가 이 호출 결과)
 *    import { makeAxhub } from "@/lib/axhub-server";
 *    const sdk = await makeAxhub();
 *    const me = await sdk.identity.me();   // me.email, me.name, me.tenants[]
 *
 * 2) 앱 데이터 · sdk.data.discover  (스키마 자동 추론)
 *    import { makeApp } from "@/lib/axhub-server";
 *    const app = await makeApp(); // sdk.tenant(TENANT).app(APP_SLUG)
 *    const todos = await app.data.discover<{ id: string; title: string; done: boolean }>("todos");
 *    // owner-scoped 테이블(owner_column)은 무필터 list 가 내 행만 자동 반환 (SDK ≥2.1.2).
 *    // non-owner-scoped 테이블은 최소 1개 where 필수 (mass-scan guard — ValidationError)
 *    const page = await todos.list({ where: where("done").eq(false), limit: 20 });
 *    await todos.insert({ title: "할 일", done: false });
 *
 * 3) Gateway · 외부 DB/SaaS 조회  (connector 이름으로, parameterized SQL, audit log)
 *    import { queryConnector } from "@/lib/axhub-server";
 *    // connector 이름만 — UUID·tenant 스코프는 helper 가 자동 처리 (connectors.list() 로 resolve)
 *    const res = await queryConnector<{ id: number; name: string }>({
 *      connector: "my-db",           // connector 이름 (UUID 아님)
 *      path: "public/employees",     // connector 안 리소스 경로
 *      sql: "SELECT id, name FROM employees WHERE active = ? LIMIT ?",
 *      params: [true, 10],           // ✅ 항상 parameterized
 *    });
 *    // res.rows (컬럼 매핑된 객체) / res.rowCount / res.allowed (false 면 정책 deny)
 *
 * 4) Query DSL · where / and  (raw SQL 금지 · or/not 은 push 불가 → ValidationError)
 *    import { where, and, defineSchema } from "@ax-hub/sdk";
 *    const Orders = defineSchema({ table: "orders", columns: { status: "string", total: "number" }});
 *    // push 가능: top-level and + eq/ne/gt/gte/lt/lte/in/like — "A 또는 B" 는 in([...]) 으로
 *    const filter = and(where(Orders.cols.status).eq("paid"), where("priority").in(["high", "urgent"]));
 *    const page = await app.data.table(Orders).list({ where: filter, select: ["status","total"] as const, limit: 50 });
 *
 * 5) 에러 처리 · error.code 분기  (Korean message 매칭 금지)
 *    import { AxHubError, ConflictError } from "@ax-hub/sdk";
 *    try {
 *      await app.data.discover("todos").then(t => t.insert({ id: "t1" }));
 *    } catch (e) {
 *      if (e instanceof ConflictError) {  // 중복 키 처리
 *      } else if (e instanceof AxHubError) console.error(e.code, e.category, e.requestId);
 *    }
 * ───────────────────────────────────────────────────────────────────────────── */
