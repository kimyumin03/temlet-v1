// axhub SDK 서버 전용 factory (Next.js Server Component / Route Handler / Server Action).
// 클라이언트 컴포넌트에서 import 금지 — next/headers 는 server-only.
//
// 모델:
//   - 요청별 새 AxHubClient 인스턴스 (모듈 레벨 싱글톤 금지: 사용자 JWT 가 섞임).
//   - 들어온 요청의 axhub 세션 쿠키(_hub_access) 를 JWT 로 사용 → SDK 가 Authorization: Bearer 처리.
//   - defaultTenantSlug 자동 주입 → sdk.apps / sdk.identity / sdk.app() 가 슬러그 자동 인지.
//
// 사용:
//   const sdk = await makeAxhub()
//   const me  = await sdk.identity.me               // GET /api/v1/me, 사용자 자격
//   const app = await makeApp()                     // sdk.tenant(TENANT).app(APP_SLUG)
//   const orders = await app.data.discover('orders')
//   const { rows } = await queryConnector({ connector: 'my-db', path: 'schema/table', sql: 'SELECT ... LIMIT ?', params: [100] })
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 치환해 박아요.
// 로컬에서 직접 돌릴 땐 .env 의 APPHUB_* 가 우선해요.
import { cookies } from 'next/headers'
import { AxHubClient, type TenantScopedClient, type AppScopedClient, type TenantGatewayClient, type GatewayQueryResult } from '@ax-hub/sdk'

const API_BASE = process.env.APPHUB_API_URL || 'https://api.axhub.ai'
export const APP_SLUG = process.env.APPHUB_APP_SLUG || 'temlet'
export const TENANT = process.env.APPHUB_TENANT || 'jocodingax'

const isSet = (v: string): boolean => Boolean(v) && !v.includes('{{')

// 환경값 + tenant/app slug 가 모두 placeholder 치환됐는지 확인.
// false 면 SDK 호출 직전에 명시적 에러로 끊고 사용자에게 axhub 배포 / .env 안내.
export function isAxhubConfigured(): boolean {
  return isSet(API_BASE) && isSet(APP_SLUG) && isSet(TENANT)
}

// 들어온 요청의 _hub_access 쿠키 → JWT. 요청 스코프 밖(빌드 등)에서는 빈 문자열.
async function readHubAccessToken(): Promise<string> {
  try {
    return (await cookies()).get('_hub_access')?.value ?? ''
  } catch {
    return ''
  }
}

// per-user 응답이 Next.js fetch cache 에 묻혀 다른 요청과 섞이지 않도록 모든 호출을 no-store 로.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...(init ?? {}), cache: 'no-store' })

// 요청별 SDK 인스턴스. 절대 모듈 레벨에 캐싱 금지 (사용자 자격 혼선).
export async function makeAxhub(): Promise<AxHubClient> {
  if (!isAxhubConfigured()) {
    throw new Error(
      'axhub SDK 가 설정되지 않았어요. axhub 로 배포하면 자동 주입돼요. ' +
        '로컬에서 직접 실행 중이라면 .env.local 의 APPHUB_API_URL / APPHUB_APP_SLUG / APPHUB_TENANT 를 채워 주세요.',
    )
  }
  const token = await readHubAccessToken()
  return new AxHubClient({
    baseUrl: API_BASE,
    // 토큰이 없으면 NoAuth 로 떨어져 401 이 자연스럽게 surface 돼요.
    ...(token ? { token, tokenType: 'jwt' as const } : {}),
    defaultTenantSlug: TENANT,
    fetch: noStoreFetch,
  })
}

// tenant + app 스코프까지 한 줄로 잡아주는 편의 helper.
// vibe coder 가 가장 자주 쓰는 패턴: makeApp().data.discover('todos') 식.
// 동적 테이블 read/write 는 보통 lib/data.ts 의 table() 을 거쳐요 (owner_id 격리 컨벤션 포함).
export async function makeApp(): Promise<AppScopedClient> {
  const sdk = await makeAxhub()
  return sdk.tenant(TENANT).app(APP_SLUG)
}

// tenant 만 잡힌 클라이언트가 필요할 때 (apps.list, tenants.* 등).
export async function makeTenant(): Promise<TenantScopedClient> {
  const sdk = await makeAxhub()
  return sdk.tenant(TENANT)
}

// Gateway 전용 스코프. ⚠️ gateway 엔드포인트는 tenant 경로에 *UUID* 를 요구해요 (slug 거부 → 400 invalid_format).
// slug 기반인 makeTenant() 로는 gateway 가 안 돼요. me() 로 현재 tenant 의 UUID 를 받아 스코프해요.
export async function makeGateway(): Promise<TenantGatewayClient> {
  const sdk = await makeAxhub()
  const me = await sdk.identity.me()
  const tenant = me.tenants?.find((t) => t.tenantSlug === TENANT)
  if (!tenant) {
    throw new Error(
      `현재 로그인 사용자가 tenant '${TENANT}' 의 멤버가 아니에요. ` +
        'gateway 는 이 tenant 의 UUID 가 필요해요 — APPHUB_TENANT 설정과 로그인 계정을 확인해 주세요.',
    )
  }
  return sdk.tenant(tenant.tenantId).gateway
}

// 외부 DB/SaaS connector 조회 — connector "이름" 으로 호출하면 UUID 를 자동 resolve 해요 (UUID 하드코딩 불필요).
// gateway 함정(tenant UUID 스코프 · connector UUID · parameterized SQL)을 전부 감싼 편의 helper.
//
//   const { rows } = await queryConnector<{ id: number; name: string }>({
//     connector: 'my-db',          // connector 이름 (gateway.catalog.listConnectors() 의 .name) — UUID 아님
//     path: 'public/employees',    // connector 안 리소스 경로 (스키마/테이블)
//     sql: 'SELECT id, name FROM public.employees WHERE active = ? LIMIT ?',  // ⚠️ PostgreSQL: 스키마 포함 필수 (path 의 '/'→'.' 변환)
//     params: [true, 100],         // ✅ 항상 parameterized — 사용자 입력을 sql 문자열에 직접 박지 마요
//   })
//   // rows: 컬럼명으로 매핑된 객체 배열 · res.allowed=false 면 정책 deny (res.denyReason) · res.columns 메타
export async function queryConnector<Row extends Record<string, unknown> = Record<string, unknown>>(input: {
  connector: string
  path: string
  sql: string
  params?: unknown[]
  rowLimit?: number
}): Promise<GatewayQueryResult<Row>> {
  const gw = await makeGateway()
  const connectors = await gw.catalog.listConnectors()
  const connector = connectors.find((c) => c.name === input.connector)
  if (!connector) {
    const names = connectors.map((c) => c.name).join(', ') || '(없음)'
    throw new Error(`connector '${input.connector}' 를 찾지 못했어요. 사용 가능: ${names}`)
  }
  return gw.query.run<Row>({
    connectorId: connector.id,
    path: input.path,
    sql: input.sql,
    params: input.params ?? [],
    ...(input.rowLimit !== undefined ? { rowLimit: input.rowLimit } : {}),
  })
}
