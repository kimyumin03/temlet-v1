# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어서 설명해요. 결과는 화면으로 확인.

## Stack
Next.js 16 (App Router · RSC · Server Actions) · React 19 · TypeScript strict · Tailwind 3 · Node 20+ · **`@ax-hub/sdk 2.x`** (백엔드 호출은 항상 SDK 경유).

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `app/page.tsx` 수정 → 2. `makeApp().data.discover` 추가 → 3. 결과 카드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:3000 새로고침 → '환영합니다, {이름}님' 카드 + 백엔드 호출 치트시트 보여야 해요. 안 보이면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
   추가로 할 일은 한국어로 적어두고 사용자가 결정.
4. **Honest failure** — 못 만들면 plainly 말해요. "아직 안 풀렸어요. 시도: A, B. 모름: C." 가짜 진행/성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요. (단, `@ax-hub/sdk 2.x` 는 이미 설치돼 있으니 다시 설치 금지.)

## axhub 리소스 준비 — 데이터/시크릿 코드를 짜기 *전에* (에이전트 필수)

> 사용자는 "대화 저장되게 / 주문 목록 보여줘 / OpenAI 로 답변 생성" 처럼 **결과만** 말해요.
> axhub 가 제공하는 **동적 DB** 와 **환경변수 주입** 은 사용자가 몰라요 — 에이전트가 코드보다 먼저 아래를 처리해야 배포 후에도 동작해요.
> axhub 플러그인이 있으면 `tables` / `env` 스킬이 미리보기+동의까지 대신 처리해요. 아래 CLI 는 그 스킬이 없을 때의 정확한 명령 형태예요.

### R1. 저장/조회/기록 요청 → 동적 테이블부터 (코드보다 먼저)
데이터를 담을 테이블이 backend 에 **먼저 있어야** 해요. 없으면 코드가 404/400 으로 깨져요.
1. 확인: `axhub tables list --app <APP_SLUG> --json`
2. 없으면 생성. **사용자마다 자기 데이터만 보는 경우(대부분) → `owner_id` 컬럼 + `--owner-column owner_id`**:
   ```bash
   # id · created_at · updated_at 은 자동 추가 — 선언하지 마세요.
   # 컬럼 타입 목록은 axhub tables column-types --app <APP_SLUG> --json (정수는 integer 아닌 int).
   axhub tables create chat_messages --app <APP_SLUG> \
     --column 'owner_id:text' --column 'role:text' --column 'content:text' \
     --owner-column owner_id --execute --json
   ```

### R2. owner_id 격리는 backend 몫 — 코드에서 owner_id 를 만지지 마세요
- insert: `owner_id` 를 **직접 넣지 마세요**. 로그인 사용자로 backend 가 자동 설정해요.
- list/get: **본인 행만** 자동 반환돼요. owner_id 필터를 직접 걸지 마세요.
- 모두가 공유하는 공용 테이블은 owner_column 없이 만들되, 그땐 `list()` 에 **필터가 반드시** 있어야 해요 (owner 도 필터도 없으면 400).

### R3. 데이터 호출은 로그인 세션 + 요청 스코프 안에서만
- read/write 는 **로그인한 사용자의 세션 쿠키**로 인증돼요. 비로그인 호출은 401.
- 호출 위치는 **Route Handler · Server Action · 요청 중 렌더** 안에서만 (S5 참조). 빌드 타임이나 모듈 최상단에서 부르면 토큰이 없어 401.
- 동적 테이블 접근은 항상 `lib/data.ts` 의 `table()` 로 (raw `fetch('/data/...')` 금지).

### R4. 코드가 secret(API 키 등)을 쓰면 → axhub env 에 등록 (배포 필수)
`.env.local` 만 채우면 **로컬만** 돌아가요. 배포 환경엔 그 값이 없어 배포 preflight 가 막히거나 런타임에 `env: <KEY> not found` 로 깨져요.
1. `axhub.yaml` 의 `env` 에 **이름과 scope 만** 선언 (값은 적지 않음). `scope` 는 `build` / `runtime` / `both` — 런타임에 쓰는 API 키는 `runtime`:
   ```yaml
   env:
     required:
       - { name: OPENAI_API_KEY, scope: runtime }
   ```
2. 값은 CLI 로 등록 (콘솔도 되지만 CLI 권장 · 값은 stdin 으로만 — 명령행 노출 방지). `--stage` 는 위 `scope` 와 같은 값(`build`/`runtime`/`both`, 생략 시 양쪽):
   ```bash
   printf %s "$OPENAI_API_KEY" | axhub env set OPENAI_API_KEY --app <APP_SLUG> --secret --from-stdin --stage runtime --json
   ```
- `APPHUB_API_URL` / `APPHUB_APP_SLUG` / `APPHUB_TENANT` 는 axhub 가 **자동 주입**해요 — 직접 등록 불필요. 소스에 `{{...}}` 가 그대로 보이거나 `isAxhubConfigured()` 가 false 면 아직 미배포/미설정 상태이니, 코드를 깨지 말고 그 사실을 사용자에게 알려요.

## SDK 사용 프로토콜 (axhub 백엔드 호출 규칙)

> 이 템플릿의 axhub 백엔드 호출은 **항상** `@ax-hub/sdk 2.x` 경유. raw `fetch()` 로 `api.axhub.ai` 를 직접 때리면 안 돼요.
> 사용자 자격은 `lib/axhub-server.ts` 의 `makeAxhub()` factory 가 자동 처리해요.

### S1. 진입점은 factory 만 — 모듈 레벨 클라이언트 금지
- ✅ 매 호출마다 `const sdk = await makeAxhub()` 또는 `const app = await makeApp()`.
- ❌ 파일 최상단에 `const sdk = new AxHubClient({...})` 캐싱 — 사용자 자격이 다음 요청에 누설돼요.
- 이유: 들어온 요청의 `_hub_access` 쿠키마다 다른 사용자. SDK 인스턴스는 그 요청 안에서만 유효.

### S2. tenant/app 스코프는 helper 로 — 슬러그 하드코딩 금지
- ✅ `const app = await makeApp()` → `app.data.discover('todos')`.
- ✅ tenant 만 필요하면 `const t = await makeTenant()` → `t.apps.list()`.
- ❌ `sdk.tenant('my-tenant').app('my-app')` 처럼 슬러그 문자열 박지 마요 — `lib/axhub-server.ts` 의 `TENANT`/`APP_SLUG` 상수가 환경별로 다름.
- ❌ flat 호출 (`sdk.apps.create(...)` 같이 tenant 스코프 없이) 금지 — `TenantSlugRequiredError` 떨어져요. (단, `sdk.identity.*` 는 tenant 불필요 — 예외.)

### S3. 데이터 호출은 discover 또는 defineSchema — raw URL 금지
- ✅ 진입점은 `lib/data.ts` 의 `table<Row>('todos')` — `makeApp().data.discover` 를 한 줄로 감싼 거예요. 테이블은 먼저 만들어야 해요 (위 R1, owner_id 는 R2).
- ✅ 빠른 prototyping: `await app.data.discover<{ id: string; title: string }>('todos')`.
- ✅ 안정 코드: `defineSchema({ table: 'todos', columns: { id: 'uuid', title: 'string' } })` 후 `app.data.table(Todos)`.
- ❌ `sdk.http.request(...)` / `fetch('/data/...')` 직접 호출 — SDK 가 cursor / where / projection 다 알아서 해요.
- 검색 필터는 `where()` / `and()` 헬퍼만 사용 (push 가능: top-level and + eq/ne/gt/gte/lt/lte/in/like — `or()`/`not()` 은 push 불가라 `ValidationError`). raw SQL 금지 (`raw()` 는 사용자가 명시 요청할 때만).

### S4. 에러는 `error.code` / `instanceof` 로 분기 — 메시지 문자열 매칭 금지
- ✅ `if (err instanceof ConflictError) { ... }` 또는 `if (err instanceof AxHubError && err.code === 'slug_taken')`.
- ❌ `if (err.message.includes('이미 존재'))` — 백엔드 메시지는 한국어/번역 변경 가능, machine-readable 한 건 `code` / `category` 뿐.
- 자주 쓰는 클래스: `ValidationError`, `UnauthenticatedError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitedError`, `AxHubError` (catch-all).

### S5. 서버 전용 — 클라이언트 컴포넌트에서 import 금지
- ✅ `app/page.tsx`, `app/api/.../route.ts`, Server Action 안에서만 `lib/axhub-server.ts` import.
- ❌ `"use client"` 컴포넌트에서 `makeAxhub` / `makeApp` import — `next/headers` 가 server-only 라 빌드 깨져요.
- 클라이언트에서 백엔드가 필요하면 Route Handler (`app/api/.../route.ts`) 거치게.

### S6. Gateway query — 외부 DB/SaaS 조회는 `queryConnector()` 로
> **이 기능은 핵심.** 외부 시스템(자체 PostgreSQL/MySQL/SaaS connector) 데이터를 axhub 가 만든 데이터처럼 안전하게 읽어요.
> 모든 호출은 audit log 에 기록되고, connector 권한 정책으로 게이트돼요. 직접 DB 접속 금지.

> ⚠️ **gateway 는 tenant 경로에 UUID 를 요구해요 (slug 거부 → 400 invalid_format).** slug 기반 `makeTenant()` 로는 gateway 가 안 돼요.
> `lib/axhub-server.ts` 의 `makeGateway()` (me() 로 tenant UUID 자동 스코프) / `queryConnector()` 를 쓰세요.

#### 기본 사용 — connector "이름" 으로 (UUID 자동 resolve)
```ts
import { queryConnector } from '@/lib/axhub-server'
const res = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',          // connector 이름 (gateway.connectors.list() 의 .name) — UUID 아님, helper 가 resolve
  path: 'public/employees',    // connector 안 리소스 경로/테이블
  sql: 'SELECT id, name FROM public.employees WHERE active = ? LIMIT ?',  // placeholder 는 engine 별: mysql `?`, postgres `$1`
  params: [true, 10],          // ✅ 항상 parameterized — SQL injection 방지
  rowLimit: 10,                // 옵션: 결과 cap
})
// res.rows: 컬럼명으로 매핑된 객체 배열 · res.rowCount · res.columns · res.allowed=false 면 정책 deny (res.denyReason)
```

#### 저수준 — 직접 스코프가 필요할 때
```ts
import { makeGateway } from '@/lib/axhub-server'
const gw = await makeGateway()                  // tenant UUID 로 스코프된 gateway (makeTenant 아님!)
const connectors = await gw.connectors.list()   // 배열 반환 — .find(c => c.name === 'my-db') 로 UUID 확보
const engines    = await gw.engines.list()      // postgres / mysql / ... + capabilities
const res = await gw.query.run({ connectorId: connectors[0].id, path: 'schema/table', sql: 'SELECT 1' })
```
- `connectors.list()` / `resources.list()` 는 **배열** 반환 (pagination 봉투 아님).
- `connectors.create()` / `update()` / `delete()` 는 admin ring — 평일 운영은 read-only 권장.

#### 절대 규칙 (Gateway)
- ✅ **PostgreSQL SQL 테이블명은 스키마 포함 필수** — `path: 'schema/table'` 이면 SQL 도 `FROM schema.table`. `FROM table` 만 쓰면 `AxHubError(internal_error)` 발생. path 의 `'/'`를 `'.'`으로 바꾸면 돼요.
- ✅ `queryConnector()` 우선 — connector 이름만 넘기면 connector UUID·tenant UUID 스코프를 helper 가 처리.
- ✅ **항상 parameterized SQL** — placeholder + `params: [...]`. 사용자 입력을 SQL 문자열에 직접 박지 마요.
- ✅ `connector` / `path` / `sql` 은 코드 상수 — 사용자 값은 `params` 로만 (권한 우회·injection 방지).
- ✅ `rowLimit` 명시 — 무한 결과 방지.
- ✅ `res.allowed === false` 확인 — 정책으로 가려진 결과 (`res.denyReason`).
- ✅ 에러 분기: `PoolStaleError` (401, 자격 만료), `PermissionDeniedError` (정책 거부), `AxHubError.code`.
- ❌ `makeTenant()` (slug) 로 gateway 호출 — tenant UUID 가 아니라 **400 invalid_format**. `makeGateway()` / `queryConnector()` 만.
- ❌ connector UUID 하드코딩 — connector 이름으로 넘기면 자동 resolve.
- ❌ 모듈-레벨에 gateway 결과 캐싱 — 자격·데이터가 사용자별로 달라요.

### S7. Query DSL — `where()` / `and()` (+ 명시 요청 시 `raw()`) 만 사용
> 데이터 API (`app.data.discover` / `app.data.table(Schema)`) 의 `list` / `count` 의 `where` 인자는 **DSL 객체** 만 받아요.
> SQL 문자열 직접 박지 말고 헬퍼 함수 조합.

#### 비교 연산자
```ts
import { where, and, or, not, defineSchema } from '@ax-hub/sdk'

where('status').eq('paid')         // status = 'paid'
where('status').ne('archived')     // status != 'archived'
where('total').gt(100)             // total > 100
where('total').gte(100)            // total >= 100
where('total').lt(1000)
where('total').lte(1000)
where('status').in(['paid', 'pending'])   // status IN (...)
```

#### LIKE 검색 — `%` / `_` / `\` 자동 escape (SQL injection / ReDoS 방어)
```ts
where('title').like.contains('주문')      // title LIKE '%주문%'  ('%' / '_' escape)
where('title').like.startsWith('axhub')   // title LIKE 'axhub%'
where('title').like.endsWith('.png')      // title LIKE '%.png'
where('title').like.raw('axhub\\_%')      // 사용자가 직접 패턴 작성 — assertSafeLikePattern 가 ReDoS 차단
```
- raw 패턴은 길이 1024 / `%` 연속 4회 / `%X%` 6 세그먼트 넘으면 `ValidationError(code: 'like_pattern_redos')` 던져요.

#### 조합 — top-level and 만 push 가능
```ts
// 라이브 백엔드가 받는 필터는 top-level and + eq/ne/gt/gte/lt/lte/in/like 뿐이에요.
// or()/not() 은 NonPushable — list/count 에 넣으면 SDK 가 ValidationError 로 즉시 거부해요.
// "A 또는 B" 는 in([...]) 으로, 그 외 OR/NOT 분기는 호출을 나눠서 처리해요.
const filter = and(
  where('status').eq('paid'),
  where('total').gt(100),
  where('priority').in(['high', 'urgent']),
)
await app.data.table(Orders).list({ where: filter, limit: 50 })
```

#### 타입 강제 — defineSchema + `Orders.cols.<field>`
```ts
const Orders = defineSchema({
  table: 'orders',
  columns: {
    id: 'uuid',
    status: { type: 'enum', values: ['paid', 'pending', 'cancelled'] as const },
    total: 'number',
  },
})
// ✅ 컴파일 타임에 컬럼/타입 강제 — 오타시 TS 에러
where(Orders.cols.status).eq('paid')     // 'archived' 넣으면 TS error
where(Orders.cols.total).gt(100)         // string 넣으면 TS error
```

#### Projection — 필요한 컬럼만
```ts
const minimal = await app.data.table(Orders).list({
  where: where(Orders.cols.status).eq('paid'),
  select: ['id', 'total'] as const,        // 백엔드 _select=id,total → Pick<Row, 'id'|'total'>
  orderBy: [{ field: 'id', dir: 'asc' }],
  limit: 100,
})
// minimal.items[0].total 은 number, .status 는 타입에서 사라짐
```

#### Pagination — offset 전용 (`cursor` / `page`)
```ts
const opts = { where: where('status').eq('paid'), orderBy: [{ field: 'id', dir: 'asc' }] as const }
const first = await app.data.table(Orders).list({ ...opts, limit: 50 })
const next  = await app.data.table(Orders).list({ ...opts, cursor: first.nextCursor! })  // 숫자 offset cursor
const page3 = await app.data.table(Orders).list({ ...opts, page: 3, pageSize: 50 })      // 1-based page 도 가능
```
- AX Hub data API 는 **offset 전용**이에요. `after:` / `before:` keyset cursor 는 deprecated — 넣으면 `LegacyCursorError` 로 거부돼요. `list()` 가 돌려준 `nextCursor` (숫자 offset) 또는 `page` 만 쓰세요.

#### 절대 규칙 (DSL)
- ✅ 모든 필터는 `where()` / `and()` 헬퍼 조합 (or/not 은 push 불가 → ValidationError).
- ✅ `list` / `count` 는 non-owner-scoped 테이블에서 **최소 1개 where 필수** (mass-scan guard — 없으면 `ValidationError(code: 'where_required')`). **owner-scoped 테이블(owner_column 설정)은 무필터 호출이 합법** — 내 행만 자동 반환돼요 (SDK ≥2.1.2).
- ✅ 검색어는 사용자 입력 그대로 `like.contains(userInput)` 에 넘겨도 안전 (escape 자동).
- ❌ `raw('SELECT ...')` 는 사용자가 명시 요청할 때만 — 보통은 쓸 일 없어요 (data API 는 `where` 가 SQL 을 대신함).
- ❌ `where` 인자로 문자열 SQL 직접 박는 거 금지 (`where: 'status = paid'` 같은 거 ❌).
- ❌ orderBy 무시한 cursor 사용 — `orderBy` 의 fingerprint 가 cursor 와 안 맞으면 `InvalidCursorError`.

## Framework-Specific Rules (Next.js)

- `lib/axhub-server.ts` 는 **Server-side 전용** (`next/headers` 사용). `"use client"` 컴포넌트에서 import 금지.
- 새 axhub API 호출은 항상 Route Handler (`app/api/.../route.ts`) 또는 Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `lib/axhub-server.ts`(server 전용, `next/headers`)를 `"use client"` 컴포넌트에서 import.
- DO NOT raw `fetch()` 로 `api.axhub.ai` 또는 `APPHUB_API_URL` 을 직접 호출 — 항상 `makeAxhub()` / `makeApp()` 경유.
- DO NOT 모듈 레벨에 `AxHubClient` 인스턴스를 캐싱 (사용자 자격 누설).
- DO NOT slug/tenant 를 코드에 하드코딩 — `lib/axhub-server.ts` 의 `TENANT` / `APP_SLUG` 상수 또는 helper 사용.
- DO NOT `AxHubError.message` 한국어 문자열로 분기 — `code` / `category` / `instanceof` 만.
- DO NOT Gateway `query.run({ sql })` 에 사용자 입력을 그대로 박기 — 항상 `params: [...]` 로 분리 (parameterized SQL).
- DO NOT `connectorId` / `path` 를 사용자 입력으로 동적 결정 — admin 이 발급한 ID, 코드 상수만.
- DO NOT data API 의 `where` 에 SQL 문자열 직접 박기 — `where()` / `and()` 헬퍼만 (or/not 은 push 불가).
- DO NOT 사용자 세션 쿠키(`_hub_access`)/토큰을 응답 본문·로그에 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치 (`@ax-hub/sdk 2.x` 는 이미 들어가 있어 재설치 금지).
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## axhub-server.ts 신뢰 모델 (1-line)

이 (Next.js) 템플릿은 **server-side**. SDK helper = `makeAxhub` / `makeApp` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()`.
인증: 들어온 요청의 세션 쿠키(`next/headers` 의 `cookies()` 로 읽은 `_hub_access`)를 `AxHubClient({ token, tokenType: 'jwt' })` 로 박아 SDK 가 `Authorization: Bearer` 자동 처리. 정적 API key 안 씀. 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## SDK 빠른 레퍼런스

```ts
// Server Component / Route Handler / Server Action 안에서
import { makeAxhub, makeApp, makeTenant } from '@/lib/axhub-server'
import {
  AxHubError, ConflictError, NotFoundError, ValidationError, PermissionDeniedError,
  defineSchema, where, and, or, not,
} from '@ax-hub/sdk'

// 1) 내 정보 — tenant 불필요
const sdk = await makeAxhub()
const me = await sdk.identity.me() // me.email / me.name / me.tenants[]

// 2) 앱 데이터 — discover 패턴 (스키마 자동 추론)
const app = await makeApp()
const todos = await app.data.discover<{ id: string; title: string; done: boolean }>('todos')
const page = await todos.list({ where: where('done').eq(false), limit: 20 })
await todos.insert({ title: '할 일', done: false })

// 3) 앱 데이터 — defineSchema 패턴 (안정/타입 강제)
const Todos = defineSchema({
  table: 'todos',
  columns: { id: 'uuid', title: 'string', done: 'bool' },
})
const todosTyped = app.data.table(Todos)
await todosTyped.list({ where: where(Todos.cols.done).eq(false) })

// 4) 에러 처리
try {
  await todos.insert({ id: 'dup' })
} catch (err) {
  if (err instanceof ConflictError) {/* 중복 키 — UI 에서 다른 값 안내 */}
  else if (err instanceof ValidationError) {/* err.fields[] 보고 폼 표시 */}
  else if (err instanceof AxHubError) console.error(err.code, err.category, err.requestId)
  else throw err
}

// 5) Gateway query — 외부 DB / SaaS connector 조회 (connector 이름으로; helper 가 tenant UUID + connector UUID resolve)
import { queryConnector } from '@/lib/axhub-server'
const employees = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',     // connector 이름 (UUID 아님)
  path: 'public/employees',
  sql: 'SELECT id, name FROM public.employees WHERE active = ? LIMIT ?',  // ⚠️ PostgreSQL: 스키마 포함 필수
  params: [true, 10],     // ✅ 항상 parameterized
  rowLimit: 10,
})
// employees.rows (컬럼 매핑된 객체) / employees.rowCount / employees.allowed

// 6) Query DSL — 데이터 API filter
const filter = and(
  where('status').eq('paid'),
  where('total').gt(100),
  where('priority').in(['high', 'urgent']),  // or()/not() 은 push 불가 — in 또는 호출 분리
)
const page = await app.data.discover<{ status: string; total: number }>('orders')
  .then(o => o.list({ where: filter, select: ['status', 'total'] as const, limit: 50 }))
```

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --branch main`. 사용자 명시 요청 후에만.
