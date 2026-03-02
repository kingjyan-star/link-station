# 🔗 링크 스테이션 (Link Station)

여러 사람이 같은 방에 모여 서로를 선택해 짝을 이루는 **실시간 매칭 게임**입니다.  
친구들과 함께 QR코드로 방을 공유하고, 서로를 선택해보세요!

**바로 체험하기:** https://link-station-pro.vercel.app

---

## 📱 어떻게 즐기나요?

1. **닉네임 입력** → 방 만들기 또는 방 참여하기
2. **방 만들기** → QR코드로 친구들에게 공유
3. **친구들이 QR 스캔** → 같은 방에 입장
4. **게임 시작** → 참여자 중 한 명을 선택
5. **서로 선택한 사람끼리** → 매칭 성공! 🎉

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
