# 武林地圖 — 디자인 톤 가이드 (v3)

> 2026-05-14 정착된 디자인 톤.
> 데이터 v2(한국 신무협 34개) + Esri Shaded Relief 베이스로 합의.
> 변경 이력은 `docs/archive/iteration-log.md` 참조.

## 컨셉

- **세피아 톤 종이지도** — 옛 지도(古地圖) 느낌. 진중하고 어두운 톤.
- **명조체 한글** — 무협 분위기의 첫 시각 신호.
- **카테고리는 색**, 위치 신뢰도는 **마커 테두리 스타일**로 표현 (의미 축 분리).
- **베이스는 라벨 없는 자연 지형도** — 현대 도시 라벨이 분위기를 깬다.

## 컬러 팔레트

### 베이스 (종이/먹)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--bg-paper` | `#ede1c8` | 사이드바·팝업·지도 배경 |
| `--bg-paper-dark` | `#d9c8a3` | hover 배경 |
| `--ink` | `#2b2014` | 본문 텍스트, 마커 테두리 |
| `--ink-soft` | `#5a4a36` | 보조 텍스트, 라벨 |
| `--line` | `#b29a73` | 디바이더, 경계선 |
| `--accent` | `#8a1c1c` | 강조 (예약, 미사용) |

### 카테고리 색 (v2 — 한국 신무협)

| 토큰 | 카테고리 | 색 |
|------|----------|----|
| `--c-jeongpa` | 정파 | `#2f6b3a` (짙은 녹색) |
| `--c-saega`   | 세가 | `#2c5278` (감청색) |
| `--c-sapa`    | 사파 | `#7a4520` (갈색) |
| `--c-seoeoe`  | 세외 | `#6b4a8a` (자색) |
| `--c-magyo`   | 마교 | `#6d1b1b` (혈홍색) |
| `--c-gwan`    | 관 | `#b89000` (황금색) |
| `--c-gita`    | 기타 | `#777777` (회색) |

> **사용 안 함**: `--c-heukdo` 토큰은 옛 무림(v1) 흔적. 한국 신무협에선 흑도가 사파에 포함되어 분리 카테고리 없음. 토큰은 archive로 보존.

> **명도 원칙**: 모든 카테고리 색은 종이 배경(`#ede1c8`) 위 + sepia 필터 통과 후에도 대비가 유지되도록 어둡게 잡았다.

> **새 카테고리 추가 시**: 채도 낮은 어두운 톤 유지. 형광색·파스텔톤 금지.

## 타이포그래피

- **폰트 스택**: `'Nanum Myeongjo', 'Noto Serif KR', 'Songti SC', 'STSong', serif`
- **사이드바 h1 (`武林地圖`)**: 28px, letter-spacing 4px, weight 700
- **사이드바 h2 (섹션 라벨)**: 13px, letter-spacing 2px, uppercase, `--ink-soft`
- **본문**: 14px, line-height 1.55
- **한자명(`name_zh`)**: 12~14px, `--ink-soft`, letter-spacing 1~2px
- **info-base-label**: 11px, uppercase, letter-spacing 1px
- **권역 라벨**: 24px, letter-spacing 10px, weight 700, opacity 0.45, `--ink-soft`
- 영문/한자 라벨은 letter-spacing 넓혀 도장(篆刻) 느낌.

## 레이아웃

```
┌──────────────┬────────────────────────────────┐
│ Sidebar      │                                │
│ 320px        │            Map                 │
│              │            (sepia filter)      │
│ - header     │            평면 (pitch 0)       │
│ - filters    │                                │
│ - info       │      [권역 라벨 12개 떠 있음]      │
│ - footer     │                                │
└──────────────┴────────────────────────────────┘
```

- 사이드바 폭: **320px 고정**
- 섹션 구분: `1px solid var(--line)` 가로선
- 사이드바 내부 padding: `16px 22px`

## 지도 스타일 (v3 — 정착)

### 베이스 타일
- **Esri World Shaded Relief**
  - URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}`
  - maxzoom: 13
  - 무료, 인증 불필요, 라벨 없음
  - paint: `raster-opacity: 1.0` (그 외 조정 없음)

### 시점
- **평면 (pitch 0°)** — 종이지도 관습대로
- **hillshade·terrain 없음** — 베이스 자체에 음영이 baked되어 있어 추가 레이어 불필요
- **초기 뷰**: center `[108, 34]`, zoom `3.6`
- **줌 범위**: minZoom `2.5`, maxZoom `10`
- **컨트롤**: NavigationControl, compass 끔

### CSS 필터 (지도 컨테이너에 적용)
```css
filter: sepia(0.35) saturate(0.9) brightness(1.02) contrast(1.05);
```

### 권역 라벨 (HTML Marker로 오버레이)
12개: 중원·강남·파촉·영남·새북·서역·서장·남만·북해·요동·천축·대막
- 24px (요동·천축·대막은 20px), letter-spacing 10px
- `pointer-events: none` (마커 클릭 방해 없음)
- 종이색 `text-shadow`로 글로우

## 마커

- **모양**: 원형, 16px, 2px 테두리(`--ink`)
- **채움**: 카테고리 색
- **그림자**: `0 1px 3px rgba(0, 0, 0, 0.4)` — 종이 위에 도장 찍은 느낌
- **hover**: `transform: scale(1.4)`, transition 0.15s
- **z-index**: 5
- **신뢰도 표현**:
  - `confidence: high` / `medium` → 실선 테두리
  - `confidence: low` → **점선 테두리** (`border-style: dashed`)

> 색은 카테고리, 테두리는 신뢰도. 두 축을 절대 섞지 않는다.

## 팝업 & 정보 패널

### 팝업 (마커 click)
- 종이 배경, 1px 라인 보더, 4px radius
- 내용: 한국명(굵게) / 한자명(연한 회색) / 본거지 1줄
- **z-index 10** — 다른 모든 마커 위에 그려짐

### 정보 패널 (사이드바)
- **info-title**: 20px bold
- **info-zh**: 14px, `--ink-soft`, letter-spacing 2px
- **info-category**: 라운드 pill, 카테고리 색 배경, 흰 글씨, 11px, letter-spacing 1px
- **info-base**: 본거지 이름 + 성/도시
- **info-notes**: `border-top: 1px dashed --line` 위에, `white-space: pre-wrap`, 13px `--ink-soft`

> v2 변경: 무공·대표 인물·등장 작품 필드 제거. "세력-위치"만 다룬다.

## 필터 UI

- 체크박스가 아닌 **swatch + 이름 + 카운트** row.
- 비활성 상태는 `opacity: 0.35` (`.off` 클래스).
- swatch: 14px 원, `--ink` 1.5px 테두리.

## 인터랙션 원칙

- **클릭**: 가장 정보량 많은 액션 (정보 패널 갱신)
- **hover**: 가벼운 힌트 (팝업 + 마커 scale)
- **토글**: 필터 row 한 번 클릭으로 on/off
- 애니메이션은 0.12~0.15s 짧게. 무협 지도는 진중해야 한다.

## 안 하기로 한 것

- 형광색·네온
- 둥글둥글한 sans-serif (Inter, Pretendard 등)
- 위성지도 / 컬러풀한 OSM 표준 스타일
- 마커에 카테고리 색 + 신뢰도 색을 한꺼번에 표현
- 이모지로 카테고리 구분 (`🟢 정파`) — 도큐먼트 안내용으로만 허용
- **3D pitch / 진짜 terrain 융기** — 시도해봤지만 종이지도 분위기와 충돌
- **OSM/CartoDB의 도시 라벨** — 영문 지명이 무협 분위기를 깬다

## 미래 후보 (v3 이후 보류)

- 동적 카메라 (`flyTo` + 일시적 pitch)로 마커 클릭 시 시점 이동
- 자체 한지 일러스트 베이스
- 마커 클러스터링 (밀집 지역)
- 작품 모드 토글 (화산귀환·나노마신 등)
