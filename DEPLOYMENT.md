# 🚀 링크 스테이션 배포 가이드

웹에서 누구나 접속할 수 있도록 배포하는 방법을 안내합니다.

## 📋 배포 옵션

### 1. Vercel (추천) - 무료

**장점**: 간단한 설정, 자동 배포, 무료 도메인 제공

#### 배포 단계:

1. **GitHub에 코드 업로드**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/link-station.git
   git push -u origin main
   ```

2. **Vercel 배포**
   - [vercel.com](https://vercel.com) 접속
   - GitHub 계정으로 로그인
   - "New Project" 클릭
   - GitHub 저장소 선택
   - 자동으로 배포 완료!

3. **환경 변수 설정** (Vercel 대시보드에서)
   ```
   NODE_ENV=production
   ```

### 2. Netlify - 무료

**장점**: 정적 사이트 호스팅에 최적화

#### 배포 단계:

1. **빌드 설정**
   - Build command: `npm run build`
   - Publish directory: `client/build`

2. **서버리스 함수 설정**
   - `netlify/functions/server.js` 생성
   - Express 서버를 서버리스 함수로 래핑

### 3. Railway - 무료 (제한적)

**장점**: Node.js 앱에 최적화

#### 배포 단계:

1. **Railway 계정 생성**
   - [railway.app](https://railway.app) 접속

2. **GitHub 연결**
   - 저장소 연결
   - 자동 배포 설정

### 4. Heroku - 유료 (무료 플랜 종료)

**장점**: 전통적인 PaaS 서비스

#### 배포 단계:

1. **Heroku CLI 설치**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **앱 생성 및 배포**
   ```bash
   heroku create link-station-app
   git push heroku main
   ```

## 🔧 배포 전 체크리스트

### 1. 코드 최적화
- [ ] React 앱 빌드 완료
- [ ] 환경 변수 설정
- [ ] CORS 설정 확인

### 2. 테스트
- [ ] 로컬에서 정상 작동 확인
- [ ] 모든 기능 테스트

### 3. 배포 설정
- [ ] package.json 스크립트 확인
- [ ] 배포 플랫폼별 설정 파일 생성

## 🌐 도메인 설정

### 커스텀 도메인 (선택사항)

1. **도메인 구매**
   - GoDaddy, Namecheap 등에서 도메인 구매

2. **DNS 설정**
   - A 레코드: 배포된 서버 IP
   - CNAME: 서브도메인 설정

## 📱 모바일 최적화

배포된 앱은 자동으로 모바일 최적화됩니다:
- 반응형 디자인
- 터치 친화적 UI
- PWA 기능 (선택사항)

## 🔒 보안 고려사항

1. **환경 변수**
   - 민감한 정보는 환경 변수로 관리
   - `.env` 파일은 Git에 커밋하지 않음

2. **CORS 설정**
   - 허용된 도메인만 접근 가능
   - 프로덕션 환경에서 제한적 설정

## 🚨 문제 해결

### 일반적인 문제들:

1. **CORS 오류**
   - 서버의 CORS 설정 확인
   - 클라이언트 URL이 허용 목록에 있는지 확인

2. **빌드 실패**
   - Node.js 버전 확인
   - 의존성 설치 확인

3. **Socket.IO 연결 실패**
   - 서버 URL 설정 확인
   - 방화벽 설정 확인

## 📊 모니터링

### 성능 모니터링
- Vercel Analytics (Vercel 사용 시)
- Google Analytics 추가 가능

### 에러 추적
- Sentry 연동 (선택사항)
- 서버 로그 모니터링

## 🎯 추천 배포 순서

1. **Vercel** (가장 간단)
2. **Railway** (Node.js 앱에 최적)
3. **Netlify** (정적 사이트 + 서버리스)

## 📞 지원

배포 과정에서 문제가 발생하면:
1. 해당 플랫폼의 문서 확인
2. GitHub Issues에 문제 보고
3. 커뮤니티 포럼 활용

---

**성공적인 배포를 위해 단계별로 차근차근 진행하세요!** 🚀
