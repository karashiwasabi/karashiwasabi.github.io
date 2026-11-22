// -*- coding: utf-8 -*-
/**
 * 『地図と一緒によむ八十日間世界一周』階層対応 共通地図コントローラ（shared_map_controller.js）
 *
 * 【階層仕様（Lv.1 大陸 > Lv.2 国 > Lv.3 地方 > Lv.4 都市 > Lv.5 地区 > Lv.6 街区・施設）】
 * 1. オートスケール・ベースマップ：広域（Zoom <= 8）は自然地形図、都市・街区（Zoom >= 9）は詳細都市地形図へ自動切替。
 * 2. ズーム連動LOD（詳細度集約）：引いた縮尺では都市内の細かいスポットを親都市ピン（例：ロンドン · 7）へ自動集約し、
 *    ズームイン時のみ地区・街区ピンへ段階展開してラベルの団子重なりを防ぐ。
 * 3. 階層パンくずバー：地図上部に「🌍 世界 › 大陸 › 国 › 地方 › 都市 › 地点」を表示し、任意の親階層へワンクリックで引ける。
 */
(function (global) {
  'use strict';

  // ============================================================================
  // レイアウト・縮尺・階層LOD定数（マジックナンバー厳禁：単位・役割を明示）
  // ============================================================================
  const PIN_MARKER_PANE_Z_INDEX = 620;            // 地点ピン専用ペインのz-index
  const BREADCRUMB_BAR_Z_INDEX = 680;             // 地図左上 階層パンくずバーのz-index（索引オーバーレイ1500より下）
  const MAX_TILE_ZOOM = 18;                       // 詳細都市・街路タイルの最大ズーム倍率
  const MAX_PHYSICAL_NATIVE_ZOOM = 8;             // 自然地形図タイルのネイティブ最大ズーム倍率
  const AUTO_STREET_MAP_SWITCH_ZOOM = 9;          // 自然地形図から詳細都市図へ自動切替する境界ズーム倍率
  const STATE_STANDARD_ZOOM = 6;                  // 地方・広域エリアの標準フォールバック縮尺

  const CITY_CLUSTER_ZOOM_THRESHOLD = 11;         // これ未満のズームでは tier>=5（地区・施設）を親都市(tier=4)ピンに集約
  const DISTRICT_CLUSTER_ZOOM_THRESHOLD = 14;     // これ未満のズームでは親が地区(tier=5)の施設(tier=6)を親地区ピンに集約

  const WORLD_OVERVIEW_LAT = 28.0;                // 「🌍 世界」ボタン押下時の世界俯瞰中心緯度
  const WORLD_OVERVIEW_LNG = 12.0;                // 「🌍 世界」ボタン押下時の世界俯瞰中心経度
  const WORLD_OVERVIEW_ZOOM = 2;                  // 「🌍 世界」ボタン押下時の世界俯瞰ズーム倍率

  const FIT_BOUNDS_PADDING_PX = 36;               // エリアポリゴン表示時の上下左右余白(px)
  const DEFAULT_PIN_CIRCLE_RADIUS_M = 1200;       // 半径未指定時の強調サークル半径(m)
  const PIN_FOCUS_ANIM_DURATION_SEC = 0.45;       // クリック移動時のアニメーション時間(秒)

  const PIN_MARKER_RADIUS_PX = 6.5;               // 通常ピンの半径(px)
  const CLUSTER_PIN_RADIUS_PX = 8.5;              // 子スポットを集約した親都市ピンの半径(px)
  const PIN_MARKER_BORDER_WEIGHT_PX = 1.8;        // 丸ピンの白縁線幅(px)
  const PIN_TOOLTIP_OFFSET_Y_PX = -7;             // ピンラベルの上方向オフセット(px)

  const RIVER_BASE_WEIGHT_PX = 2.5;               // 河川ラインの基本線幅(px)
  const RIVER_BASE_OPACITY = 0.72;                // 河川ラインの基本不透明度
  const RIVER_HIGHLIGHT_OUTER_WEIGHT_PX = 7.0;    // 河川選択時の外側ハイライト線幅(px)
  const RIVER_HIGHLIGHT_INNER_WEIGHT_PX = 3.5;    // 河川選択時の内側ハイライト線幅(px)

  const AREA_HIGHLIGHT_BORDER_WEIGHT_PX = 3.0;    // エリア選択時の強調枠線幅(px)
  const PIN_CIRCLE_BORDER_WEIGHT_PX = 2.4;        // 地点選択時の強調サークル線幅(px)

  const NATURE_LABEL_WIDTH_PX = 140;              // 自然地形ラベル幅(px)
  const NATURE_LABEL_HEIGHT_PX = 20;              // 自然地形ラベル高さ(px)
  const AREA_BANNER_WIDTH_PX = 150;               // エリア強調バナー幅(px)
  const AREA_BANNER_HEIGHT_PX = 28;              // エリア強調バナー高さ(px)
  const DEFAULT_INITIAL_LAT = 51.511;             // デフォルト初期中心緯度（ロンドン）
  const DEFAULT_INITIAL_LNG = -0.112;             // デフォルト初期中心経度
  const TOP_NAV_BAR_HEIGHT_PX = 38;               // 上部ナビバー高さ(px)
  const BREADCRUMB_TOP_OFFSET_PX = 10;            // パンくずバーの上端マージン(px)
  const BREADCRUMB_SIDE_OFFSET_PX = 52;           // 左右のLeafletボタンを避けるマージン(px)
  const INDEX_OVERLAY_MARGIN_PX = 8;              // 総合索引パネルの上下左右マージン(px)
  const MOBILE_BREAKPOINT_PX = 900;               // スマホ上下分割ブレークポイント(px)
  const MOBILE_MAP_PANE_DVH = 42;                 // スマホ時の上段地図高さ比率(dvh)
  const MOBILE_READER_PANE_DVH = 58;              // スマホ時の下段本文高さ比率(dvh)

  const WORLD_LABEL_I18N = {
    ja: '🌍 世界',
    en: '🌍 World',
    zh_tw: '🌍 世界',
    zh_cn: '🌍 世界',
    ko: '🌍 세계'
  };

  const TIER_BADGE_I18N = {
    ja: { 1: '大陸', 2: '国', 3: '地方', 4: '都市', 5: '地区', 6: '地点' },
    en: { 1: 'Continent', 2: 'Country', 3: 'Region', 4: 'City', 5: 'District', 6: 'Spot' },
    zh_tw: { 1: '大洲', 2: '國家', 3: '地區', 4: '城市', 5: '城區', 6: '地點' },
    zh_cn: { 1: '大洲', 2: '国家', 3: '地区', 4: '城市', 5: '城区', 6: '地点' },
    ko: { 1: '대륙', 2: '국가', 3: '지방', 4: '도시', 5: '지구', 6: '지점' }
  };

  let sharedStyleInjected = false;
  function ensureSharedMapStyles() {
    if (sharedStyleInjected || typeof document === 'undefined') return;
    sharedStyleInjected = true;
    const styleEl = document.createElement('style');
    styleEl.id = 'antara-shared-map-styles';
    const indexTopPx = TOP_NAV_BAR_HEIGHT_PX + INDEX_OVERLAY_MARGIN_PX;
    const bcTopPx = TOP_NAV_BAR_HEIGHT_PX + BREADCRUMB_TOP_OFFSET_PX;
    styleEl.textContent = [
      '.left-pane { display: flex !important; flex-direction: column !important; overflow: hidden !important; }',
      `.vol-nav-bar { position: relative !important; top: auto !important; left: auto !important; width: 100% !important; max-width: none !important; height: ${TOP_NAV_BAR_HEIGHT_PX}px !important; min-height: ${TOP_NAV_BAR_HEIGHT_PX}px !important; flex-shrink: 0 !important; background: #2c241b !important; border: none !important; border-bottom: 1.5px solid #8c6d46 !important; border-radius: 0 !important; box-shadow: none !important; justify-content: center !important; padding: 0 10px !important; gap: 8px !important; }`,
      '#map { flex: 1 1 0% !important; width: 100% !important; height: auto !important; min-height: 0 !important; }',
      `.modal-overlay { top: ${TOP_NAV_BAR_HEIGHT_PX}px !important; }`,
      `.index-overlay { top: ${indexTopPx}px !important; left: ${INDEX_OVERLAY_MARGIN_PX}px !important; right: ${INDEX_OVERLAY_MARGIN_PX}px !important; bottom: ${INDEX_OVERLAY_MARGIN_PX}px !important; }`,
      `.hierarchy-breadcrumb-bar { position: absolute; top: ${bcTopPx}px; left: ${BREADCRUMB_SIDE_OFFSET_PX}px; right: ${BREADCRUMB_SIDE_OFFSET_PX}px; z-index: ${BREADCRUMB_BAR_Z_INDEX}; display: flex; align-items: center; flex-wrap: wrap; gap: 3px; pointer-events: none; font-family: system-ui, -apple-system, sans-serif; }`,
      '.bc-crumb-btn { pointer-events: auto; background: rgba(44, 36, 27, 0.90); color: #f6efe2; border: 1px solid #a88d63; border-radius: 4px; padding: 2px 7px; font-size: 0.73rem; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.28); line-height: 1.35; }',
      '.bc-crumb-btn:hover { background: #5d4037; color: #ffffff; border-color: #ffd54f; }',
      '.bc-crumb-btn.is-current { background: #b3392b; color: #ffffff; border-color: #ffe082; }',
      '.bc-sep { color: #3d2f1d; font-weight: 900; font-size: 0.76rem; text-shadow: 0 0 3px #fff, 0 0 3px #fff; user-select: none; }',
      '.transparent-box { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }',
      '.transparent-box::before { display: none !important; }',
      '.custom-label { display: inline-block; background: rgba(44, 36, 27, 0.92); color: #fffdf8; border: 1px solid #d4b483; border-radius: 4px; padding: 1px 6px; font-family: system-ui, -apple-system, sans-serif; font-size: 0.74rem; font-weight: 700; box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer; white-space: nowrap; }',
      '.custom-label.cluster-pin-label { background: #1a3b5c; border-color: #ffd54f; color: #ffffff; padding: 2px 8px; font-size: 0.76rem; }',
      '.custom-label.selected-pin { background: #b71c1c !important; color: #ffffff !important; border-color: #ffeb3b !important; }',
      '.area-banner-label { display: inline-block; background: rgba(216, 67, 21, 0.92); color: #ffffff; border: 1px solid #fff3e0; border-radius: 5px; padding: 2px 8px; font-family: system-ui, -apple-system, sans-serif; font-size: 0.76rem; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.28); }',
      '.nature-label-mountain, .nat-Geo-label.mountain { color: #5c4328; font-size: 0.72rem; font-weight: 700; text-shadow: 1px 1px 2px rgba(255,255,255,0.94), -1px -1px 2px rgba(255,255,255,0.94); white-space: nowrap; font-family: system-ui, -apple-system, sans-serif; text-align: center; }',
      '.nature-label-river, .nat-Geo-label { color: #155799; font-size: 0.72rem; font-weight: 700; text-shadow: 1px 1px 2px rgba(255,255,255,0.94), -1px -1px 2px rgba(255,255,255,0.94); white-space: nowrap; font-family: system-ui, -apple-system, sans-serif; text-align: center; }',
      `@media (min-width: ${MOBILE_BREAKPOINT_PX + 1}px) { .right-pane { height: 100vh; height: 100dvh; max-height: 100dvh; } }`,
      `@media (max-width: ${MOBILE_BREAKPOINT_PX}px) { .left-pane { flex: 0 0 ${MOBILE_MAP_PANE_DVH}vh !important; flex-basis: ${MOBILE_MAP_PANE_DVH}dvh !important; height: ${MOBILE_MAP_PANE_DVH}vh !important; height: ${MOBILE_MAP_PANE_DVH}dvh !important; min-height: ${MOBILE_MAP_PANE_DVH}vh !important; min-height: ${MOBILE_MAP_PANE_DVH}dvh !important; max-height: ${MOBILE_MAP_PANE_DVH}dvh !important; } .right-pane { flex: 1 1 ${MOBILE_READER_PANE_DVH}vh !important; flex-basis: ${MOBILE_READER_PANE_DVH}dvh !important; height: ${MOBILE_READER_PANE_DVH}vh !important; height: ${MOBILE_READER_PANE_DVH}dvh !important; max-height: ${MOBILE_READER_PANE_DVH}dvh !important; min-height: 0 !important; } }`
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function detectActiveUiLang() {
    const htmlLang = String((typeof document !== 'undefined' && document.documentElement.lang) || 'ja').toLowerCase();
    if (htmlLang.indexOf('en') === 0) return 'en';
    if (htmlLang.indexOf('ko') === 0) return 'ko';
    if (htmlLang.indexOf('zh-hant') === 0 || htmlLang === 'zh_tw') return 'zh_tw';
    if (htmlLang.indexOf('zh') === 0) return 'zh_cn';
    return 'ja';
  }

  function resolvePinFillColorByTier(tier, isCluster) {
    if (isCluster) return '#1565c0';
    if (tier <= 3) return '#6a1b9a';
    if (tier === 4) return '#1565c0';
    if (tier === 5) return '#2e7d32';
    return '#bf360c';
  }

  window.AntaraMapController = {
    STATE_STANDARD_ZOOM: STATE_STANDARD_ZOOM,
    create: createController
  };

  function createController(options) {
    ensureSharedMapStyles();
    const cfg = options || {};
    const containerId = cfg.containerId || 'map';
    const toastId = cfg.toastId || 'mapToast';
    const initialCenter = cfg.initialCenter || [DEFAULT_INITIAL_LAT, DEFAULT_INITIAL_LNG];
    const initialZoom = typeof cfg.initialZoom === 'number' ? cfg.initialZoom : 12;
    const places = Array.isArray(cfg.places) ? cfg.places : Object.values(cfg.places || {});
    const naturalFeatures = (Array.isArray(cfg.naturalFeatures) ? cfg.naturalFeatures : []).map(feat => (
      feat && !feat.type ? Object.assign({ type: feat.kind === 'river' ? 'river' : 'mountain' }, feat) : feat
    ));
    const riverLines = Array.isArray(cfg.riverLines) ? cfg.riverLines : [];
    const singlePinOnlyOnFocus = Boolean(cfg.singlePinOnlyOnFocus);
    const natureLabelMode = cfg.natureLabelMode || 'volume';
    const baseNameOf = typeof cfg.displayNameOf === 'function' ? cfg.displayNameOf : null;

    const placeByKey = new Map();
    places.forEach(p => {
      if (p && p.key) placeByKey.set(p.key, p);
    });

    function nameOf(key) {
      const p = placeByKey.get(key);
      const lg = detectActiveUiLang();
      if (p && p.name_i18n && p.name_i18n[lg]) {
        return p.name_i18n[lg];
      }
      return baseNameOf ? baseNameOf(key) : key;
    }

    // 1. Leafletマップとオートスケール2層ベースタイル初期化
    const map = L.map(containerId, { maxZoom: MAX_TILE_ZOOM }).setView(initialCenter, initialZoom);

    const physicalLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: MAX_PHYSICAL_NATIVE_ZOOM,
        maxZoom: MAX_TILE_ZOOM
      }
    );
    const topoStreetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: MAX_TILE_ZOOM,
        maxZoom: MAX_TILE_ZOOM
      }
    );
    const shadedReliefLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 13,
        maxZoom: MAX_TILE_ZOOM
      }
    );

    let autoScaleTileEnabled = true;
    function syncAutoScaleBaseLayer() {
      if (!autoScaleTileEnabled) return;
      const z = map.getZoom();
      if (z >= AUTO_STREET_MAP_SWITCH_ZOOM) {
        if (!map.hasLayer(topoStreetLayer)) map.addLayer(topoStreetLayer);
        if (map.hasLayer(physicalLayer)) map.removeLayer(physicalLayer);
      } else {
        if (!map.hasLayer(physicalLayer)) map.addLayer(physicalLayer);
        if (map.hasLayer(topoStreetLayer)) map.removeLayer(topoStreetLayer);
      }
    }
    syncAutoScaleBaseLayer();

    L.control.layers(
      {
        '① 詳細都市・地形図（街路まで拡大可）': topoStreetLayer,
        '② 自然地形図（広域・大陸俯瞰）': physicalLayer,
        '③ 陰影白地図（地形のみ）': shadedReliefLayer
      },
      null,
      { position: 'topright' }
    ).addTo(map);

    map.on('baselayerchange', () => {
      // ユーザーが手動でレイヤーメニューを切り替えた場合は手動選択を尊重し、ズーム時は自動切替を再開できるよう判定
      autoScaleTileEnabled = false;
    });

    // 地図左上：階層パンくずバーの生成
    const mapContainerEl = document.getElementById(containerId);
    const leftPaneEl = mapContainerEl ? mapContainerEl.parentElement : null;
    let breadcrumbBarEl = null;
    if (leftPaneEl) {
      breadcrumbBarEl = document.createElement('div');
      breadcrumbBarEl.className = 'hierarchy-breadcrumb-bar';
      breadcrumbBarEl.setAttribute('aria-label', 'Geographic hierarchy');
      leftPaneEl.appendChild(breadcrumbBarEl);
      if (L.DomEvent) {
        L.DomEvent.disableClickPropagation(breadcrumbBarEl);
        L.DomEvent.disableScrollPropagation(breadcrumbBarEl);
      }
    }

    const protectedIds = Array.isArray(cfg.protectedControlIds)
      ? cfg.protectedControlIds
      : [toastId];
    protectedIds.forEach(ctrlId => {
      const el = document.getElementById(ctrlId);
      if (el && L.DomEvent) {
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
      }
    });

    map.createPane('pinsTopPane');
    map.getPane('pinsTopPane').style.zIndex = String(PIN_MARKER_PANE_Z_INDEX);

    const natureGroup = L.layerGroup().addTo(map);
    riverLines.forEach(river => {
      const rLine = L.polyline(river.coords, {
        color: '#1976d2',
        weight: RIVER_BASE_WEIGHT_PX,
        opacity: RIVER_BASE_OPACITY
      }).addTo(natureGroup);
      rLine.bindTooltip(river.name, { sticky: true });
      if (typeof cfg.onRiverClick === 'function') {
        rLine.on('click', () => cfg.onRiverClick(river.key));
      }
    });

    naturalFeatures.forEach(feat => {
      const icon = natureLabelMode === 'glossary'
        ? L.divIcon({
            className: '',
            html: `<span class="nat-Geo-label ${feat.type === 'mountain' ? 'mountain' : ''}">${escapeHtml(feat.name)}</span>`,
            iconSize: [NATURE_LABEL_WIDTH_PX, NATURE_LABEL_HEIGHT_PX],
            iconAnchor: [NATURE_LABEL_WIDTH_PX / 2, NATURE_LABEL_HEIGHT_PX / 2]
          })
        : L.divIcon({
            className: feat.type === 'mountain' ? 'nature-label-mountain' : 'nature-label-river',
            html: feat.name,
            iconSize: [NATURE_LABEL_WIDTH_PX, NATURE_LABEL_HEIGHT_PX],
            iconAnchor: [NATURE_LABEL_WIDTH_PX / 2, NATURE_LABEL_HEIGHT_PX / 2]
          });
      L.marker([feat.lat, feat.lng], { icon: icon, interactive: false }).addTo(natureGroup);
    });

    const baseAreaGroup = L.layerGroup().addTo(map);
    const pinMarkerGroup = L.layerGroup().addTo(map);
    let activeHighlightLayers = [];
    let currentDirectKeys = [];
    let focusedPlaceKey = '';

    global.addEventListener('resize', () => {
      map.invalidateSize();
    });

    function isPinPlace(p) {
      return Boolean(p && (p.is_pin || (!p.is_area && !p.is_river)));
    }

    function computeCommonHierarchyPath(keys) {
      const validPaths = keys
        .map(k => placeByKey.get(k))
        .filter(p => p && Array.isArray(p.hierarchy_path) && p.hierarchy_path.length > 0)
        .map(p => p.hierarchy_path);
      if (validPaths.length === 0) return [];
      const first = validPaths[0];
      const common = [];
      for (let i = 0; i < first.length; i++) {
        const candidate = first[i];
        if (validPaths.every(path => path[i] === candidate)) {
          common.push(candidate);
        } else {
          break;
        }
      }
      return common;
    }

    function updateBreadcrumbBar() {
      if (!breadcrumbBarEl) return;
      const lg = detectActiveUiLang();
      const worldLabel = WORLD_LABEL_I18N[lg] || WORLD_LABEL_I18N.ja;

      let pathKeys = [];
      if (focusedPlaceKey && placeByKey.has(focusedPlaceKey)) {
        const fp = placeByKey.get(focusedPlaceKey);
        pathKeys = Array.isArray(fp.hierarchy_path) ? fp.hierarchy_path.slice() : [focusedPlaceKey];
      } else if (currentDirectKeys.length > 0) {
        pathKeys = computeCommonHierarchyPath(currentDirectKeys);
      }

      // 現在のズームより極端に細かい下位階層は未フォーカス時は省く
      const curZoom = map.getZoom();
      if (!focusedPlaceKey && curZoom < CITY_CLUSTER_ZOOM_THRESHOLD) {
        pathKeys = pathKeys.filter(k => {
          const p = placeByKey.get(k);
          return p && Number(p.tier || 4) <= 4;
        });
      }

      const parts = [
        `<button type="button" class="bc-crumb-btn${pathKeys.length === 0 ? ' is-current' : ''}" data-bc-world="1">${escapeHtml(worldLabel)}</button>`
      ];
      pathKeys.forEach((k, idx) => {
        const isLast = idx === pathKeys.length - 1 && k === focusedPlaceKey;
        const prefix = isLast ? '📍 ' : '';
        parts.push('<span class="bc-sep">›</span>');
        parts.push(
          `<button type="button" class="bc-crumb-btn${isLast ? ' is-current' : ''}" data-bc-key="${escapeHtml(k)}">${prefix}${escapeHtml(nameOf(k))}</button>`
        );
      });
      breadcrumbBarEl.innerHTML = parts.join('');
    }

    if (breadcrumbBarEl) {
      breadcrumbBarEl.addEventListener('click', ev => {
        const worldBtn = ev.target.closest('[data-bc-world]');
        if (worldBtn) {
          autoScaleTileEnabled = true;
          focusedPlaceKey = '';
          clearHighlights(true);
          map.setView([WORLD_OVERVIEW_LAT, WORLD_OVERVIEW_LNG], WORLD_OVERVIEW_ZOOM, { animate: true });
          updateBreadcrumbBar();
          return;
        }
        const keyBtn = ev.target.closest('[data-bc-key]');
        if (keyBtn) {
          const k = keyBtn.getAttribute('data-bc-key');
          autoScaleTileEnabled = true;
          handleMapItemClick(k);
        }
      });
    }

    function clearHighlights(hideToast = true) {
      activeHighlightLayers.forEach(layer => map.removeLayer(layer));
      activeHighlightLayers = [];
      document.querySelectorAll('.custom-label').forEach(el => {
        el.classList.remove('selected-pin');
      });
      if (hideToast) {
        focusedPlaceKey = '';
        const toastEl = document.getElementById(toastId);
        if (toastEl) toastEl.style.display = 'none';
      }
    }

    function handleMapItemClick(placeKey) {
      if (typeof cfg.onPlaceShapeClick === 'function') {
        cfg.onPlaceShapeClick(placeKey);
      } else {
        focusPlace(placeKey, placeKey, true);
      }
    }

    /**
     * 現在の地図ズーム倍率に合わせて、階層LOD（親都市・親地区への集約）を適用したピンを描画する。
     */
    function drawLodPins() {
      pinMarkerGroup.clearLayers();
      const curZoom = map.getZoom();
      const directSet = new Set(currentDirectKeys);

      // 表示候補の地点リスト（エリアが直接指定されていた場合はその代表点ではなく配下またはスキップ）
      const rawPinPlaces = places.filter(p => isPinPlace(p) && directSet.has(p.key));

      // ズームに応じた集約先決定
      const groupedByTarget = new Map();
      rawPinPlaces.forEach(p => {
        let repKey = p.key;
        const tier = Number(p.tier || 4);
        if (curZoom < CITY_CLUSTER_ZOOM_THRESHOLD && tier >= 5 && p.city_key && placeByKey.has(p.city_key)) {
          repKey = p.city_key;
        } else if (
          curZoom < DISTRICT_CLUSTER_ZOOM_THRESHOLD &&
          tier >= 6 &&
          p.parent_key &&
          placeByKey.has(p.parent_key) &&
          Number(placeByKey.get(p.parent_key).tier) === 5
        ) {
          repKey = p.parent_key;
        }
        if (!groupedByTarget.has(repKey)) {
          groupedByTarget.set(repKey, []);
        }
        groupedByTarget.get(repKey).push(p.key);
      });

      groupedByTarget.forEach((memberKeys, repKey) => {
        const repPlace = placeByKey.get(repKey);
        if (!repPlace) return;
        const tier = Number(repPlace.tier || 4);
        const subCount = memberKeys.filter(mk => mk !== repKey).length;
        const isCluster = subCount > 0 && (memberKeys.length > 1 || memberKeys[0] !== repKey);
        const isSelected = focusedPlaceKey === repKey || (isCluster && memberKeys.includes(focusedPlaceKey));

        const marker = L.circleMarker([repPlace.lat, repPlace.lng], {
          pane: 'pinsTopPane',
          radius: isCluster ? CLUSTER_PIN_RADIUS_PX : PIN_MARKER_RADIUS_PX,
          fillColor: resolvePinFillColorByTier(tier, isCluster),
          color: isCluster ? '#ffd54f' : '#ffffff',
          weight: PIN_MARKER_BORDER_WEIGHT_PX,
          fillOpacity: 0.95
        }).addTo(pinMarkerGroup);

        const countSuffix = isCluster ? ` · ${memberKeys.length}` : '';
        const clsList = ['custom-label'];
        if (isCluster) clsList.push('cluster-pin-label');
        if (isSelected) clsList.push('selected-pin');

        marker.bindTooltip(
          `<span class="${clsList.join(' ')}" id="pin-label-${escapeHtml(repKey)}">${escapeHtml(nameOf(repKey))}${escapeHtml(countSuffix)}</span>`,
          {
            permanent: true,
            interactive: true,
            direction: 'top',
            offset: [0, PIN_TOOLTIP_OFFSET_Y_PX],
            className: 'transparent-box'
          }
        );
        marker.on('click', () => {
          autoScaleTileEnabled = true;
          handleMapItemClick(repKey);
        });
      });

      updateBreadcrumbBar();
    }

    map.on('zoomend', () => {
      syncAutoScaleBaseLayer();
      drawLodPins();
    });

    function renderPlaceKeys(rawKeysIterable, keepHighlights = false) {
      if (!keepHighlights) {
        clearHighlights(true);
      }
      baseAreaGroup.clearLayers();
      currentDirectKeys = Array.from(new Set(rawKeysIterable || []));
      drawLodPins();
    }

    function renderOverviewProvinces() {
      clearHighlights(true);
      baseAreaGroup.clearLayers();
      pinMarkerGroup.clearLayers();
      currentDirectKeys = [];
      updateBreadcrumbBar();
    }

    function focusPlace(placeKey, clickedRawSurface = '', showToast = true) {
      if (typeof cfg.beforeFocusPlace === 'function') {
        cfg.beforeFocusPlace();
      }
      const found = placeByKey.get(placeKey);
      clearHighlights(false);
      if (!found) return false;

      focusedPlaceKey = found.key;
      autoScaleTileEnabled = true;

      const targetZoom = typeof found.zoom === 'number' ? found.zoom : STATE_STANDARD_ZOOM;

      map.invalidateSize();
      map.stop();

      if (found.is_area && found.area_polygon) {
        map.fitBounds(found.area_polygon, {
          padding: [FIT_BOUNDS_PADDING_PX, FIT_BOUNDS_PADDING_PX],
          maxZoom: targetZoom
        });

        const areaPoly = L.polygon(found.area_polygon, {
          color: '#d84315',
          weight: AREA_HIGHLIGHT_BORDER_WEIGHT_PX,
          dashArray: '6, 4',
          fillColor: '#ffab40',
          fillOpacity: 0.16,
          interactive: false
        }).addTo(map);

        const bannerMarker = L.marker([found.lat, found.lng], {
          icon: L.divIcon({
            className: '',
            html: `<span class="area-banner-label">🗺️ ${escapeHtml(nameOf(found.key))}</span>`,
            iconSize: [AREA_BANNER_WIDTH_PX, AREA_BANNER_HEIGHT_PX],
            iconAnchor: [AREA_BANNER_WIDTH_PX / 2, AREA_BANNER_HEIGHT_PX / 2]
          }),
          interactive: false
        }).addTo(map);
        activeHighlightLayers.push(areaPoly, bannerMarker);
      } else if (found.is_river) {
        map.setView([found.lat, found.lng], targetZoom, {
          animate: true,
          duration: PIN_FOCUS_ANIM_DURATION_SEC
        });
        riverLines.filter(r => r.key === found.key).forEach(river => {
          const hl = L.polyline(river.coords, {
            color: '#ffeb3b',
            weight: RIVER_HIGHLIGHT_OUTER_WEIGHT_PX,
            opacity: 0.85,
            interactive: false
          }).addTo(map);
          const fg = L.polyline(river.coords, {
            color: '#d32f2f',
            weight: RIVER_HIGHLIGHT_INNER_WEIGHT_PX,
            opacity: 0.95,
            interactive: false
          }).addTo(map);
          activeHighlightLayers.push(hl, fg);
        });
      } else {
        if (singlePinOnlyOnFocus) {
          currentDirectKeys = [found.key];
        } else {
          const keysToShow = new Set(currentDirectKeys);
          keysToShow.add(found.key);
          currentDirectKeys = Array.from(keysToShow);
        }

        map.setView([found.lat, found.lng], targetZoom, {
          animate: true,
          duration: PIN_FOCUS_ANIM_DURATION_SEC
        });

        const circleRadiusM = typeof found.radius_m === 'number' && found.radius_m > 0
          ? found.radius_m
          : DEFAULT_PIN_CIRCLE_RADIUS_M;
        const ptCircle = L.circle([found.lat, found.lng], {
          radius: circleRadiusM,
          color: '#c62828',
          weight: PIN_CIRCLE_BORDER_WEIGHT_PX,
          fillColor: '#ff5252',
          fillOpacity: 0.22,
          interactive: false
        }).addTo(map);
        activeHighlightLayers.push(ptCircle);
      }

      syncAutoScaleBaseLayer();
      drawLodPins();

      const toastEl = document.getElementById(toastId);
      if (!toastEl) return true;
      if (!showToast) {
        toastEl.style.display = 'none';
        return true;
      }

      const lg = detectActiveUiLang();
      const tierNames = TIER_BADGE_I18N[lg] || TIER_BADGE_I18N.ja;
      const tierBadge = tierNames[Number(found.tier || 4)] || '';
      const pathArr = Array.isArray(found.hierarchy_path) ? found.hierarchy_path : [found.key];
      const ancestorsStr = pathArr.slice(0, -1).map(k => nameOf(k)).join(' › ');
      const pathHtml = ancestorsStr
        ? ` <span style="font-size:0.76rem; color:#d7ccc8;">（${escapeHtml(ancestorsStr)}）</span>`
        : '';
      const badgeHtml = tierBadge
        ? `<span style="background:#5d4037; color:#ffe082; border-radius:3px; padding:1px 5px; font-size:0.7rem; margin-right:5px;">${escapeHtml(tierBadge)}</span>`
        : '';

      toastEl.innerHTML =
        `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%;">` +
          `<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📍 ${badgeHtml}<strong>${escapeHtml(nameOf(found.key))}</strong>${pathHtml}</div>` +
          `<button onclick="document.getElementById('${escapeHtml(toastId)}').style.display='none'" style="background:transparent; border:none; color:#ccc; cursor:pointer; font-size:0.9rem; line-height:1; padding:0 2px; flex-shrink:0;" title="Close">✕</button>` +
        `</div>`;
      toastEl.style.display = 'inline-flex';
      return true;
    }

    return {
      getMap: () => map,
      clearHighlights: clearHighlights,
      renderPlaceKeys: renderPlaceKeys,
      renderOverviewProvinces: renderOverviewProvinces,
      focusPlace: focusPlace,
      refreshLanguageLabels: () => {
        drawLodPins();
        updateBreadcrumbBar();
      }
    };
  }
})(window);
