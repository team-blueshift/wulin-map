import maplibregl, { Map, Marker, Popup } from 'maplibre-gl';
import yaml from 'js-yaml';
import 'maplibre-gl/dist/maplibre-gl.css';
import factionsYaml from '../data/factions.yaml?raw';

type Category = '정파' | '세가' | '사파' | '세외' | '마교' | '관' | '기타';

interface Platform {
  type: string;
  host: string;
}

interface Work {
  author: string;
  platforms: Platform[];
  summary: string;
}

interface Common {
  aliases?: string[];
  martial_arts?: string[];
  figures?: string[];
  traits?: string;
  history?: string;
}

interface Variant {
  figures?: string[];
  role?: string;
  note?: string;
  location_variant?: string;
  internal_structure?: string;
}

interface Faction {
  id: string;
  name_ko: string;
  name_zh: string;
  category: Category;
  subcategory: string | null;
  base: {
    name: string;
    province: string;
    coords: [number, number];
    coord_confidence: 'high' | 'medium' | 'low';
  };
  notes: string;
  common?: Common;
  variants?: Record<string, Variant>;
}

const CATEGORY_COLORS: Record<Category, string> = {
  정파: 'var(--c-jeongpa)',
  세가: 'var(--c-saega)',
  사파: 'var(--c-sapa)',
  세외: 'var(--c-seoeoe)',
  마교: 'var(--c-magyo)',
  관: 'var(--c-gwan)',
  기타: 'var(--c-gita)',
};

const CATEGORY_ORDER: Category[] = ['정파', '세가', '사파', '세외', '마교', '관', '기타'];

// 각 세력 도장(篆刻)용 대표 한자
const MARKER_CHARS: Record<string, string> = {
  // 구파일방
  shaolin: '少',
  wudang: '武',
  huashan: '華',
  emei: '峨',
  kunlun: '崑',
  zhongnan: '終',
  kongtong: '崆',
  dianchang: '點',
  qingcheng: '靑',
  hainan: '海',
  gaibang: '丐',
  // 오대세가
  'nangung-clan': '南',
  'tang-clan': '唐',
  'peng-clan': '彭',
  'zhuge-clan': '葛',
  'murong-clan': '慕',
  'huangfu-clan': '皇',
  // 신주오패
  maninbang: '萬',
  'jangang-suro': '江',
  nokrim: '綠',
  haomun: '下',
  heukgwibo: '黑',
  // 새외 7궁
  'bukhae-binggung': '氷',
  'namman-yasugung': '蠻',
  'podalrap-gung': '布',
  'marahyeol-gung': '摩',
  'namhae-taeyang': '陽',
  'gwangpung-sa': '風',
  'daeroeum-sa': '雷',
  // 마교
  'cheonma-singyo': '魔',
  // 관
  hwanggung: '宮',
  geumuiwi: '錦',
  dongchang: '廠',
  // 기타
  'murim-maeng': '盟',
};

const data = yaml.load(factionsYaml) as {
  works: Record<string, Work>;
  factions: Faction[];
};
const factions = data.factions;
const works = data.works ?? {};

const map = new Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'base': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 13,
        attribution: '© Esri — Source: USGS, Esri, NGA',
      },
    },
    layers: [
      {
        id: 'base',
        type: 'raster',
        source: 'base',
        paint: { 'raster-opacity': 1.0 },
      },
    ],
  } as any,
  center: [108, 34],
  zoom: 3.6,
  minZoom: 2,
  maxZoom: 10,
  bearing: 0,
  // maxBounds 임시 제거 (모바일 viewport 클램프 검증)
  renderWorldCopies: false,
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

// ─── 무협 권역 라벨 ───
interface Region {
  ko: string;
  coords: [number, number]; // [lat, lon]
  size?: number;
}

const REGIONS: Region[] = [
  { ko: '중원', coords: [34.5, 113.0] },
  { ko: '강남', coords: [30.5, 119.5] },
  { ko: '파촉', coords: [30.5, 104.5] },
  { ko: '영남', coords: [23.5, 110.5] },
  { ko: '새북', coords: [44.0, 112.0] },
  { ko: '서역', coords: [41.0, 82.0] },
  { ko: '서장', coords: [31.0, 88.0] },
  { ko: '남만', coords: [23.5, 101.0] },
  { ko: '북해', coords: [52.0, 100.0] },
  { ko: '요동', coords: [43.0, 124.0], size: 20 },
  { ko: '천축', coords: [25.5, 84.0], size: 20 },
  { ko: '대막', coords: [40.5, 92.0], size: 20 },
];

map.on('load', () => {
  for (const r of REGIONS) {
    const el = document.createElement('div');
    el.className = 'region-label';
    if (r.size) el.style.fontSize = `${r.size}px`;
    el.textContent = r.ko;
    const [lat, lon] = r.coords;
    new Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map);
  }
});

const activeCategories = new Set<Category>(CATEGORY_ORDER);
const markers = new globalThis.Map<string, Marker>();

map.on('load', () => {
  renderMarkers();
  renderFilterList();
  showHint();
  document.getElementById('count')!.textContent = String(factions.length);
  relocateMapControl();
});

// 모바일/데스크톱 전환에 따라 maplibre 컨트롤 부모 변경
function relocateMapControl(): void {
  const ctrl = document.querySelector<HTMLElement>('.maplibregl-ctrl-top-right');
  if (!ctrl) return;
  const isMob = window.matchMedia('(max-width: 768px)').matches;
  if (isMob) {
    const toolbar = document.getElementById('mobile-toolbar');
    if (toolbar && ctrl.parentElement !== toolbar) toolbar.appendChild(ctrl);
  } else {
    const mapEl = map.getContainer();
    if (mapEl && ctrl.parentElement !== mapEl) mapEl.appendChild(ctrl);
  }
}

window.matchMedia('(max-width: 768px)').addEventListener('change', () => {
  relocateMapControl();
  map.resize();
});

// 시트 height 변화(애니메이션) 끝나면 지도 resize — 마커 위치 보정
document.getElementById('sidebar')?.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'height') map.resize();
});

// viewport 변화 (특히 모바일 도구바 변동) 시 resize
window.addEventListener('resize', () => map.resize());
window.addEventListener('orientationchange', () => {
  setTimeout(() => map.resize(), 100);
});

// 지도 빈 곳 클릭 → 미선택 (hint로 복귀)
map.on('click', (e) => {
  const target = e.originalEvent?.target as HTMLElement | undefined;
  // 마커·팝업·라벨 클릭은 무시
  if (target?.closest?.('.faction-marker, .maplibregl-popup, .region-label')) return;
  showHint();
});

function renderMarkers() {
  for (const m of markers.values()) m.remove();
  markers.clear();

  for (const f of factions) {
    if (!activeCategories.has(f.category)) continue;

    const el = document.createElement('div');
    el.className = `faction-marker confidence-${f.base.coord_confidence}`;
    el.style.background = CATEGORY_COLORS[f.category];
    el.title = `${f.name_ko} (${f.name_zh})`;
    el.textContent = MARKER_CHARS[f.id] ?? '';

    const popup = new Popup({ offset: 14, closeButton: false }).setHTML(`
      <div class="popup-title">${escapeHtml(f.name_ko)}</div>
      <div class="popup-zh">${escapeHtml(f.name_zh)}</div>
      <div class="popup-base">${escapeHtml(f.base.name)} · ${escapeHtml(f.base.province)}</div>
    `);

    const [lat, lon] = f.base.coords;
    const marker = new Marker({ element: el, anchor: 'center' })
      .setLngLat([lon, lat])
      .setPopup(popup)
      .addTo(map);

    el.addEventListener('click', () => {
      showInfo(f);
    });
    markers.set(f.id, marker);
  }
}

function renderFilterList() {
  const desktopContainer = document.getElementById('filter-list')!;
  const mobileContainer = document.getElementById('mobile-filter-list');
  desktopContainer.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  const counts = new globalThis.Map<Category, number>();
  for (const f of factions) {
    counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
  }

  for (const cat of CATEGORY_ORDER) {
    const count = counts.get(cat) ?? 0;
    if (count === 0) continue;

    // 두 컨테이너에 동일한 row(데스크톱)와 chip(모바일) 렌더
    const desktopRow = document.createElement('div');
    desktopRow.className = 'filter-row';
    desktopRow.innerHTML = `
      <span class="filter-swatch" style="background: ${CATEGORY_COLORS[cat]}"></span>
      <span class="filter-name">${cat}</span>
      <span class="filter-count">${count}</span>
    `;

    const mobileChip = document.createElement('button');
    mobileChip.className = 'filter-chip';
    mobileChip.innerHTML = `
      <span class="filter-swatch" style="background: ${CATEGORY_COLORS[cat]}"></span>
      <span class="filter-name">${cat}</span>
      <span class="filter-count">${count}</span>
    `;

    const toggle = () => {
      if (activeCategories.has(cat)) {
        activeCategories.delete(cat);
        desktopRow.classList.add('off');
        mobileChip.classList.add('off');
      } else {
        activeCategories.add(cat);
        desktopRow.classList.remove('off');
        mobileChip.classList.remove('off');
      }
      renderMarkers();
    };

    desktopRow.addEventListener('click', toggle);
    mobileChip.addEventListener('click', toggle);

    desktopContainer.appendChild(desktopRow);
    if (mobileContainer) mobileContainer.appendChild(mobileChip);
  }
}

function showInfo(f: Faction) {
  const el = document.getElementById('info-content')!;
  const color = CATEGORY_COLORS[f.category];

  const parts: string[] = [];

  // 헤더
  parts.push(`
    <div class="info-title">${escapeHtml(f.name_ko)}</div>
    <div class="info-zh">${escapeHtml(f.name_zh)}</div>
    <span class="info-category" style="background: ${color}">${escapeHtml(f.category)}${
      f.subcategory && f.subcategory !== '새외' ? ' · ' + escapeHtml(f.subcategory) : ''
    }</span>

    <div class="info-base-label">본거지</div>
    <div class="info-base">${escapeHtml(f.base.name)} (${escapeHtml(f.base.province)})</div>
  `);

  // common 섹션
  if (f.common) {
    const c = f.common;
    const rows: string[] = [];
    if (c.aliases?.length) {
      rows.push(rowHtml('별칭', c.aliases.map(escapeHtml).join(' · ')));
    }
    if (c.martial_arts?.length) {
      rows.push(rowHtml('무공', c.martial_arts.map(escapeHtml).join(', ')));
    }
    if (c.figures?.length) {
      rows.push(rowHtml('대표 인물', c.figures.map(escapeHtml).join(', ')));
    }
    if (c.traits) {
      rows.push(rowHtml('특징', md(c.traits)));
    }
    if (c.history) {
      rows.push(`
        <div class="info-history">${md(c.history.trim())}</div>
      `);
    }
    if (rows.length) {
      parts.push(`
        <div class="info-section">
          <div class="info-section-label">공통</div>
          ${rows.join('')}
        </div>
      `);
    }
  }

  // variants 섹션
  if (f.variants && Object.keys(f.variants).length) {
    const variantRows = Object.entries(f.variants)
      .map(([workName, v]) => renderVariant(workName, v))
      .join('');

    parts.push(`
      <div class="info-section">
        <div class="info-section-label">작품별 묘사</div>
        <div class="info-variants">${variantRows}</div>
      </div>
    `);
  }

  // notes (디테일 없거나 추가)
  if (f.notes && !f.common) {
    parts.push(`<div class="info-notes">${escapeHtml(f.notes.trim())}</div>`);
  }

  el.innerHTML = parts.join('');
  bindVariantToggles();
}

function showHint(): void {
  const el = document.getElementById('info-content')!;

  el.innerHTML = `
    <div class="hint-title">武林</div>
    <p class="hint-subtitle">강호(江湖)의 세계</p>

    <p class="hint-intro">
      중원의 <strong>구파일방</strong>과 <strong>오대세가</strong>,
      중원 밖 <strong>새외 무림</strong>과 <strong>천마신교</strong>가
      얽혀 정파(正派)·사파(邪派)·마교(魔敎)가 영원히 대립하는 세계.
    </p>

    <div class="hint-section">
      <h3>큰 구도</h3>
      <ul class="hint-bullets">
        <li><strong>중원(中原)</strong> — 정파 무림의 무대. 황하·장강 일대.</li>
        <li><strong>새외(塞外)</strong> — 중원 밖의 변경. 일곱 권역.</li>
        <li><strong>십만대산</strong> — 천마신교의 본거. 작품마다 위치가 다름.</li>
      </ul>
    </div>

    <div class="hint-section">
      <h3>정파 — 무림의 양지</h3>
      <p class="hint-p">
        <span class="hint-swatch" style="background: ${CATEGORY_COLORS['정파']}"></span>
        <strong>구파일방</strong>(소림·무당·화산·아미·곤륜·종남·공동·점창·청성·해남 + 개방)과
        <span class="hint-swatch" style="background: ${CATEGORY_COLORS['세가']}"></span>
        <strong>오대세가</strong>(남궁·당·팽·제갈·모용·황보)가
        <strong>무림맹</strong>을 이루어 사파·마교에 대항한다.
      </p>
    </div>

    <div class="hint-section">
      <h3>사파 — 흑도의 다섯</h3>
      <p class="hint-p">
        <span class="hint-swatch" style="background: ${CATEGORY_COLORS['사파']}"></span>
        <strong>신주오패</strong>(神州五覇) — 만인방·장강수로채·녹림·하오문·흑귀보.
        산적, 수적, 정보, 암시장 등 정파 반대편의 세력 연합.
      </p>
    </div>

    <div class="hint-section">
      <h3>마교 — 천마를 섬기는 강자존</h3>
      <p class="hint-p">
        <span class="hint-swatch" style="background: ${CATEGORY_COLORS['마교']}"></span>
        <strong>천마신교</strong>(天魔神敎). 중원 정파의 영원한 적.
        회귀·환생 무협에서는 주역 진영으로도 자주 등장하며,
        작품마다 본거지·내부 직제·정체성이 가장 크게 달라진다.
      </p>
    </div>

    <div class="hint-section">
      <h3>새외 — 중원 밖 일곱 권역</h3>
      <p class="hint-p">
        <span class="hint-swatch" style="background: ${CATEGORY_COLORS['세외']}"></span>
        <strong>북해빙궁</strong>(시베리아)·<strong>남만야수궁</strong>(운남)·
        <strong>포달랍궁</strong>(서장)·<strong>마라혈궁</strong>(청해)·
        <strong>남해태양궁</strong>(안남)·<strong>광풍사</strong>(대막)·
        <strong>대뢰음사</strong>(천축).
      </p>
    </div>

    <p class="hint-footnote">
      지도 위 마커를 클릭하면 각 세력의 본거지와 작품별 묘사를 볼 수 있습니다.
    </p>
  `;
}

function rowHtml(label: string, value: string): string {
  return `
    <div class="info-row">
      <div class="info-row-label">${escapeHtml(label)}</div>
      <div class="info-row-value">${value}</div>
    </div>
  `;
}

function renderVariant(workName: string, v: Variant): string {
  const work = works[workName];
  const platformBadges = work?.platforms
    .map(
      (p) =>
        `<span class="platform-badge platform-${platformClass(p.type)}">${escapeHtml(p.type)}</span>`,
    )
    .join('') ?? '';

  const detailRows: string[] = [];
  if (v.role) detailRows.push(rowHtml('역할', md(v.role)));
  if (v.location_variant) detailRows.push(rowHtml('본거지', md(v.location_variant)));
  if (v.internal_structure)
    detailRows.push(rowHtml('내부 직제', md(v.internal_structure.trim())));
  if (v.figures?.length)
    detailRows.push(rowHtml('인물', v.figures.map(escapeHtml).join(', ')));
  if (v.note) detailRows.push(rowHtml('메모', md(v.note.trim())));

  const workMeta = work
    ? `
      <div class="variant-meta">
        ${work.author ? `<span class="variant-author">${escapeHtml(work.author)}</span>` : ''}
        ${work.summary ? `<div class="variant-summary">${md(work.summary.trim())}</div>` : ''}
      </div>
    `
    : '';

  return `
    <div class="variant-row" data-work="${escapeHtml(workName)}">
      <div class="variant-header">
        <span class="variant-name">${escapeHtml(workName)}</span>
        <span class="variant-badges">${platformBadges}</span>
        <span class="variant-chevron">▾</span>
      </div>
      <div class="variant-content">
        ${workMeta}
        ${detailRows.join('')}
      </div>
    </div>
  `;
}

function platformClass(type: string): string {
  if (type.includes('웹툰')) return 'webtoon';
  if (type.includes('웹소설')) return 'novel';
  if (type.includes('출판')) return 'book';
  return 'other';
}

function bindVariantToggles(): void {
  document.querySelectorAll<HTMLElement>('.variant-row').forEach((row) => {
    const header = row.querySelector<HTMLElement>('.variant-header');
    header?.addEventListener('click', () => {
      row.classList.toggle('open');
    });
  });
}

// ─── 제보 모달 ───
// repo URL 변경 시 여기만 수정.
const GITHUB_REPO = 'team-blueshift/wulin-map';

function initReportModal(): void {
  const modal = document.getElementById('report-modal') as HTMLElement;
  const openBtn = document.getElementById('report-btn') as HTMLButtonElement;
  const closeBtn = document.getElementById('report-close') as HTMLButtonElement;
  const cancelBtn = document.getElementById('report-cancel') as HTMLButtonElement;
  const form = document.getElementById('report-form') as HTMLFormElement;
  const targetSelect = document.getElementById('target') as HTMLSelectElement;

  // 대상 세력 옵션 채우기 (카테고리별 optgroup)
  for (const cat of CATEGORY_ORDER) {
    const group = factions.filter((f) => f.category === cat);
    if (!group.length) continue;
    const og = document.createElement('optgroup');
    og.label = cat;
    for (const f of group) {
      const opt = document.createElement('option');
      opt.value = f.name_ko;
      opt.textContent = `${f.name_ko} (${f.name_zh})`;
      og.appendChild(opt);
    }
    targetSelect.appendChild(og);
  }

  // 요청 유형에 따라 조건부 필드 보임
  const updateVisibleFields = () => {
    const type = (form.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value) ?? '';
    document.querySelectorAll<HTMLElement>('[data-show-on]').forEach((el) => {
      const show = el.dataset.showOn === type;
      el.style.display = show ? '' : 'none';
    });
  };
  form.querySelectorAll<HTMLInputElement>('input[name="type"]').forEach((r) => {
    r.addEventListener('change', updateVisibleFields);
  });
  updateVisibleFields();

  const open = () => {
    modal.hidden = false;
    document.body.classList.add('modal-open');
  };
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const type = (fd.get('type') as string) || '';
    const target = (fd.get('target') as string) || '';
    const workName = (fd.get('work-name') as string) || '';
    const content = (fd.get('content') as string) || '';
    const source = (fd.get('source') as string) || '';
    const contact = (fd.get('contact') as string) || '';

    let title = `[${type}]`;
    if (type === '수정' && target) title += ` ${target}`;
    else if (type === '신규 작품' && workName) title += ` ${workName}`;
    title += ' — ';

    const body = [
      `**요청 유형**: ${type}`,
      target ? `**대상 세력**: ${target}` : null,
      workName ? `**작품명**: ${workName}` : null,
      '',
      '**내용**',
      content,
      '',
      source ? `**출처**: ${source}` : null,
      contact ? `**연락처**: ${contact}` : null,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const labels = labelForType(type);
    const url = `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(
      title,
    )}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(labels)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    form.reset();
    updateVisibleFields();
    close();
  });
}

function labelForType(type: string): string {
  switch (type) {
    case '수정':
      return 'data,fix';
    case '신규 세력':
      return 'data,new-faction';
    case '신규 작품':
      return 'data,new-work';
    case '일반 피드백':
      return 'feedback';
    default:
      return 'feedback';
  }
}

initReportModal();
initBottomSheet();
initReportFab();

function initReportFab(): void {
  const fab = document.getElementById('report-fab');
  const reportBtn = document.getElementById('report-btn');
  fab?.addEventListener('click', () => reportBtn?.click());
}

// body.sheet-open 클래스 sync — FAB 숨김/표시용
function syncSheetOpenClass(): void {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const obs = new MutationObserver(() => {
    document.body.classList.toggle('sheet-open', sidebar.classList.contains('open'));
  });
  obs.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
}
syncSheetOpenClass();

// ─── 바텀시트 (모바일) ───
function initBottomSheet(): void {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const handle = sidebar.querySelector<HTMLButtonElement>('.sheet-handle');
  const header = sidebar.querySelector<HTMLElement>('header');
  const filters = sidebar.querySelector<HTMLElement>('#filters');

  // 모바일에서 헤더·카테고리는 상단 툴바로 분리됨 → 시트 peek은 CSS의 56px 유지 (핸들만 보임)
  const updatePeekHeight = () => {
    // 모바일에서 헤더/필터를 시트에 안 쓰므로 CSS 기본값 사용. 노옵.
    void header; void filters;
  };

  // 시트 높이 기반 드래그
  let startY = 0;
  let startHeight = 0;
  let isDragging = false;
  let didMove = false;

  const getPeekPx = (): number => {
    const v = getComputedStyle(sidebar).getPropertyValue('--sheet-peek').trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 340;
  };

  const getMaxHeightPx = (): number => {
    return Math.round(window.innerHeight * 0.92);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!isMobile()) return;
    startY = e.clientY;
    startHeight = sidebar.offsetHeight;
    isDragging = true;
    didMove = false;
    sidebar.classList.add('dragging');
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    if (Math.abs(deltaY) > 4) didMove = true;
    // 위로 드래그(clientY 작아짐) → 시트 커짐
    const next = Math.max(getPeekPx(), Math.min(getMaxHeightPx(), startHeight - deltaY));
    sidebar.style.height = `${next}px`;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    sidebar.classList.remove('dragging');
    sidebar.style.height = '';

    if (!didMove) {
      sidebar.classList.toggle('open');
      return;
    }

    const peek = getPeekPx();
    const maxH = getMaxHeightPx();
    const deltaY = e.clientY - startY;
    const finalHeight = Math.max(peek, Math.min(maxH, startHeight - deltaY));
    // 임계: 중간 이상이면 open, 미만이면 peek
    if (finalHeight > (peek + maxH) / 2) {
      sidebar.classList.add('open');
    } else {
      sidebar.classList.remove('open');
    }
  };

  // 드래그 가능한 영역 — 핸들 + 헤더 + 카테고리 섹션 헤더
  const dragZones: HTMLElement[] = [];
  if (handle) dragZones.push(handle);
  if (header) {
    header.classList.add('sheet-drag-zone');
    dragZones.push(header);
  }

  for (const z of dragZones) {
    z.addEventListener('pointerdown', onPointerDown);
    z.addEventListener('pointermove', onPointerMove);
    z.addEventListener('pointerup', onPointerUp);
    z.addEventListener('pointercancel', onPointerUp);
  }

  updatePeekHeight();
  window.addEventListener('resize', updatePeekHeight);

  // filters 렌더링 후 다시 측정 (DOM 변화 반영)
  requestAnimationFrame(updatePeekHeight);
}

function openSheetOnMobile(): void {
  if (!isMobile()) return;
  document.getElementById('sidebar')?.classList.add('open');
}

function isMobile(): boolean {
  return window.matchMedia('(max-width: 768px)').matches;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 미니 마크다운 — escape 후 인라인 마크다운만 변환 (XSS 안전).
// 지원: [텍스트](http://...), **굵게**, *이탤릭*, `code`
function md(text: string): string {
  let s = escapeHtml(text);
  // 링크: [텍스트](http(s)://...)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  // **굵게**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // *이탤릭* (앞뒤가 *가 아닐 때만)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // `code`
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return s;
}
