# 시작용 프롬프트 모음

처음 vibe coding 할 때 그대로 복붙하거나 살짝 바꿔서 AI 한테 던져요.

## 1. 첫 화면 만들기

```
app/page.tsx 메인 화면을 [내가 만들고 싶은 서비스 한 줄 설명] 의 첫인상에 맞게 바꿔줘.
- 제목 큰 거 하나
- 설명 문단 하나
- 클릭 가능한 버튼 1개 (눌러도 아직 동작 안 해도 됨)
- Tailwind 로 깔끔하게, 모바일에서도 안 깨지게
```

## 2. axhub Hub API 호출하는 페이지

```
/me 라우트 만들어줘. @ax-hub/sdk 2.x 의 sdk.identity.me 를 Server Component 에서 호출해서
로그인 사용자 정보 + 소속 tenant 목록을 카드로 보여줘.
lib/axhub-server.ts 의 makeAxhub() 사용. 에러는 AxHubError.code 로 분기.
```

## 3. 입력 폼 + 저장 (앱 데이터)

```
app/feedback 라우트에 피드백 입력 폼 만들어줘. Server Action 으로
makeApp().data.discover('feedback') 의 insert 호출해서 저장.
ConflictError / ValidationError 분기 처리. 저장 성공하면 "감사합니다" 토스트 띄워줘.
```

## 3-A. Gateway query — 외부 DB 조회 페이지

```
app/employees 라우트 만들어줘. lib/axhub-server.ts 의 queryConnector() 로
const res = await queryConnector({ connector: "my-db", path: "public/employees",
sql: "SELECT id, name FROM employees WHERE active = ? LIMIT ?", params: [true, 20] })
호출해서 res.rows 를 테이블로 렌더. connector 는 "이름" 으로 넘기면 helper 가 UUID 를 자동 resolve 해.
connector / sql 은 코드 상수로 (사용자 입력은 반드시 params 로). res.allowed === false 면 정책 deny 안내.
AxHubError 는 .code 로 분기 (PoolStaleError / PermissionDeniedError).
```

## 3-B. Query DSL — 필터된 목록

```
app/orders 라우트에 결제 완료 + 금액 100 이상 주문만 보여주는 페이지.
@ax-hub/sdk 2.x 의 defineSchema 로 Orders 스키마 잡고, where / and / or 로 filter 만들어
makeApp().data.table(Orders).list({ where, select: ['id','total'] as const, orderBy, limit: 50 }).
페이지네이션은 nextCursor / firstCursor 로 prev/next 버튼.
```

## 4. 디자인 폴리싱

```
app/page.tsx 디자인을 "조코딩 AX 파트너스" 브랜드 톤에 맞게 다듬어줘.
색은 보라/파랑 계열, 폰트는 시스템 산세리프, 여백 넉넉하게, 모서리 부드럽게.
```

## 5. 배포 직전 체크리스트

```
배포 전에 점검해줘:
- console.log 남은 거 있나?
- 환경변수 미설정인 곳에서 죽는 코드 있나?
- "use client" 컴포넌트가 lib/axhub-server.ts import 하는 곳 있나? (위험 — 서버 전용)
- raw fetch 로 api.axhub.ai 를 직접 호출하는 곳 있나? (반드시 SDK 경유)
- 모듈 최상단에서 new AxHubClient() 캐싱하는 곳 있나? (사용자 자격 누설 위험)
- AxHubError.message 한국어 문자열로 분기하는 곳 있나? (.code/.category 만)
- public/ 에 안 쓰는 이미지 있나?
```
