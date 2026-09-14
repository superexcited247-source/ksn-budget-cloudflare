강신나 자금관리 + 허슬 MES → Cloudflare Workers 이전본 v17

구조
- 앱/서버: Cloudflare Workers
- 정적 파일: Workers Static Assets
- 자금/MES/백업: Cloudflare R2 (버킷명 ksn-budget-data)
- 자금 주소: /
- MES 주소: /mes
- Railway의 /app/data 대신 R2에 영구 저장

중요
1) 먼저 Railway에서 전체 백업 JSON을 내려받아야 합니다.
2) Cloudflare에 이 Worker를 배포한 후 /migration 에서 그 JSON을 업로드합니다.
3) 모바일 푸시 구독은 도메인(출처)이 바뀌므로 새 Cloudflare 주소에서 각 휴대폰이 한 번씩 '알림 켜기'를 다시 해야 합니다.
4) 금융/MES 데이터와 과거 백업, VAPID 키는 이식합니다. 로그인 세션은 이식하지 않습니다.

Cloudflare 준비
- R2 버킷 생성: ksn-budget-data
- Worker secret/variable:
  APP_PASSWORD = 기존 자금관리 비밀번호
  MES_PASSWORD = 기존 MES 비밀번호
  SESSION_SECRET = 긴 임의 문자열 (예: 32자 이상)
  VAPID_SUBJECT = mailto:본인이메일 (선택)

GitHub 연동 배포
- Workers & Pages → Create application → Import a repository
- 이 폴더를 올린 GitHub 저장소 선택
- Build command: npm install (기본 설치로도 가능)
- Deploy command: npx wrangler deploy
- wrangler.jsonc의 R2 바인딩은 DATA → ksn-budget-data

이식 후 확인
- /health 에서 storage가 cloudflare-r2인지 확인
- 자금관리 로그인 → 잔액/매출/지출/주간예산/캘린더 확인
- /mes → MES 로그인 → 프로젝트/간트/작업자 확인
- 이상 없으면 새 주소를 실제 주소로 전환
- Railway는 2~3일 유지 후 중지 권장. Volume은 즉시 삭제하지 마세요.
