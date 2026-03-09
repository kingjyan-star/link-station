# 🔗 링크 스테이션 (Link Station)

**오프라인 술자리 미니게임 플랫폼** – 친구들과 한 방에 모여 QR코드로 공유하고, 여러 미니게임을 즐기세요!

**바로 체험하기:** https://link-station-pro.vercel.app  
**v3.0.1** – Liar Game 14 fixes (커스텀주제 입력, 투표/사면·처형 UI, 타이머 등)

---

## 🎮 게임 종류

### 텔레파시 게임 (Telepathy Game)

**목적:** 마음을 읽는 것처럼 서로를 선택해, 짝이 맞으면 성공!

**플로우**
1. **닉네임 입력** → 방 만들기 또는 QR로 방 참여
2. **대기실** → QR코드로 친구 초대, 모두 입장할 때까지 대기
3. **게임 시작** → 참여자 중 **한 명**을 마음으로 선택 (투표)
4. **결과** → 서로를 선택한 사람끼리 매칭 성공! 🎉

**재미 포인트**
- 동시에 선택하는 긴장감
- "나를 선택할까?" vs "이 사람이 나를 고를까?"
- 짝이 맞는 순간의 짜릿함

---

### 라이어 게임 (Liar Game / 단어 마피아)

**목적:** 비밀 단어를 아는 사람 vs 모르는 라이어, 눈치와 허세로 승부!

**플로우**
1. **단어 입력** (커스텀 모드) → 주제에 맞는 단어 제출
2. **플레이** → 비밀 단어를 아는 사람은 힌트로 증명, 라이어는 눈치채며 발언
3. **투표** → 라이어라고 생각하는 사람 지목
4. **사형수 → 사면/처형** → 지목한 사람들이 결정
5. **발표/추측** → 사형수가 라이어면 30초 안에 추측, 맞히면 라이어 승리

**재미 포인트**
- 힌트와 블러프의 줄다리기
- 투표와 사형수의 긴장감
- 라이어의 마지막 추측 한 방

비밀번호로 방을 보호할 수도 있고, 방장이 게임을 시작할 때까지 대기실에서 인원을 모을 수 있습니다.

---

## 🛠️ 기술 스택

- **프론트엔드:** React 19, QRCode.react
- **백엔드:** Node.js + Express (REST API, Vercel 서버리스)
- **저장소:** Upstash Redis (다중 인스턴스에서 상태 공유)

---

## 💻 로컬에서 실행하기

```bash
npm install
cd client && npm install && cd ..
# 프론트엔드: cd client && npm start  → http://localhost:3000
```

Redis 설정이 없어도 in-memory로 로컬에서 개발할 수 있습니다.

---

## 🚀 배포 (Vercel)

```powershell
cd client && npm run build && cd ..
copy client\build\index.html index.html
xcopy client\build\static static /E /I /Y
git add . && git commit -m "Deploy" && git push origin main
```

main 브랜치에 푸시하면 Vercel에서 자동 배포됩니다. 환경 변수에 `UPSTASH_REDIS_*`, `ADMIN_SECRET_KEY`를 설정해주세요.

---

## 📚 개발자 문서

| 파일 | 설명 |
|------|------|
| **CONTEXT.md** | 프로젝트 개요, 배포, 상태 흐름, 개발 이력 |
| **ARCHITECTURE.md** | VSA 구조, 기능 맵 |
| **project_config.md** | 코딩 규칙 및 지침 |
