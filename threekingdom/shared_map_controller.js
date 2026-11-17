// -*- coding: utf-8 -*-
/**
 * 『正史三國志』全巻リーダー・全巻横断索引 共通地図コントローラ（shared_map_controller.js）
 *
 * 【固定仕様（PROJECT_RULES.md 第2節・第8節準拠）】
 * 1. 段落移動（← →）時：その段落の地名ピン・エリア枠に入れ替えるのみで、
 *    地図の中心移動・縮尺変更（fitBounds）・先頭カードへの自動フォーカスは一切行わない。
 * 2. 記事スクロール時：地図は一切勝手に動かさない（スクロール自動連動は行わない）。
 * 3. 読者が「地名（本文の緑文字・地図ピン・索引項目）」を明示的にクリックした時のみ：
 *    その地名へ移動し、州全体が見渡せる基準縮尺（ズーム7）で表示する。
 * 4. 左下の地名トーストは「📍 地名（よみ） （現在の〇〇） [✕]」の1行に統一する。
 */
(function (global) {
  'use strict';

  // ============================================================================
  // レイアウト・縮尺・描画スタイル定数（マジックナンバー厳禁）
  // ============================================================================
  const PIN_MARKER_PANE_Z_INDEX = 620;          // 地点ピン専用ペインのz-index（強調エリア枠400より常に前面）
  const MAX_TILE_ZOOM = 13;                     // ベースタイルレイヤーの最大ズーム倍率
  const MAX_PHYSICAL_NATIVE_ZOOM = 8;           // 自然地形図タイルのネイティブ最大ズーム倍率
  const STATE_STANDARD_ZOOM = 7;                // 地名クリック時の基準縮尺（州全体が見渡せるズーム7）
  const FIT_BOUNDS_PADDING_PX = 36;             // エリアポリゴン表示時の上下左右余白(px)
  const SINGLE_PIN_CIRCLE_RADIUS_M = 14000;     // 地点フォーカス時の強調赤丸サークル半径(m)
  const PIN_FOCUS_ANIM_DURATION_SEC = 0.45;     // 地名クリック移動時のアニメーション時間(秒)

  const PIN_MARKER_RADIUS_PX = 6.5;             // 地点丸ピンの半径(px)
  const PIN_MARKER_BORDER_WEIGHT_PX = 1.8;      // 地点丸ピンの白縁線幅(px)
  const PIN_TOOLTIP_OFFSET_Y_PX = -7;           // 地点ピンラベルの上方向オフセット(px)

  const RIVER_BASE_WEIGHT_PX = 2.5;             // 常時表示する河川ラインの線幅(px)
  const RIVER_BASE_OPACITY = 0.72;              // 常時表示する河川ラインの不透明度
  const RIVER_HIGHLIGHT_OUTER_WEIGHT_PX = 7.0;  // 河川選択時の外側ハイライト線幅(px)
  const RIVER_HIGHLIGHT_INNER_WEIGHT_PX = 3.5;  // 河川選択時の内側ハイライト線幅(px)

  const COMMANDERY_BORDER_WEIGHT_PX = 1.5;      // 郡エリア枠の線幅(px)
  const PROVINCE_BORDER_WEIGHT_PX = 1.2;        // 州・広域エリア枠の線幅(px)
  const AREA_HIGHLIGHT_BORDER_WEIGHT_PX = 3.5;  // エリア選択時の強調枠線幅(px)
  const PARENT_AREA_BORDER_WEIGHT_PX = 2.4;     // 地点選択時の親エリア枠線幅(px)
  const PIN_CIRCLE_BORDER_WEIGHT_PX = 2.4;      // 地点選択時の強調サークル線幅(px)

  const NATURE_LABEL_WIDTH_PX = 140;            // 山脈・河川ラベルのアイコン幅(px)
  const NATURE_LABEL_HEIGHT_PX = 20;            // 山脈・河川ラベルのアイコン高さ(px)
  const AREA_BANNER_WIDTH_PX = 140;             // エリア強調バナーの幅(px)
  const AREA_BANNER_HEIGHT_PX = 28;             // エリア強調バナーの高さ(px)
  const PARENT_BANNER_WIDTH_PX = 100;           // 親エリアバナーの幅(px)
  const PARENT_BANNER_HEIGHT_PX = 22;           // 親エリアバナーの高さ(px)

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getShortNameWithReading(labelStr) {
    if (!labelStr) return '';
    return String(labelStr).replace(/：[^）]*）$/, '）');
  }


  // 4言語切替：shared_i18n.js 未読込・未翻訳・日本語表示では従来どおりの文字列をそのまま返す
  function localizeName(key, fallback) {
    const i18n = global.ThreeKingdomI18n;
    return i18n ? i18n.localName('place', key, fallback) : (fallback !== undefined ? fallback : key);
  }

  function localizeModern(key, fallback) {
    const i18n = global.ThreeKingdomI18n;
    return i18n ? i18n.localPlaceModern(key, fallback) : fallback;
  }

  function resolvePinFillColor(provinceName) {
    if (provinceName === '益州' || provinceName === '涼州') return '#2e7d32';
    if (provinceName === '荊州') return '#1565c0';
    if (provinceName === '揚州' || provinceName === '徐州') return '#6a1b9a';
    return '#e65100';
  }

  /**
   * 共通地図コントローラを生成・初期化する。
   * @param {Object} options 設定オブジェクト
   */
  function createController(options) {
    const cfg = options || {};
    const containerId = cfg.containerId || 'map';
    const toastId = cfg.toastId || 'mapToast';
    const initialCenter = cfg.initialCenter || [34.5, 113.8];
    const initialZoom = typeof cfg.initialZoom === 'number' ? cfg.initialZoom : 6;
    const places = Array.isArray(cfg.places) ? cfg.places : [];
    const naturalFeatures = Array.isArray(cfg.naturalFeatures) ? cfg.naturalFeatures : [];
    const riverLines = Array.isArray(cfg.riverLines) ? cfg.riverLines : [];
    const singlePinOnlyOnFocus = Boolean(cfg.singlePinOnlyOnFocus);
    const natureLabelMode = cfg.natureLabelMode || 'volume';

    const placeByKey = new Map();
    places.forEach(p => {
      if (p && p.key) placeByKey.set(p.key, p);
    });

    // 1. Leafletマップの初期化とベースタイル設定
    const map = L.map(containerId).setView(initialCenter, initialZoom);

    const shadedReliefLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: MAX_TILE_ZOOM,
        maxZoom: MAX_TILE_ZOOM
      }
    );
    const physicalLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: MAX_PHYSICAL_NATIVE_ZOOM,
        maxZoom: MAX_TILE_ZOOM
      }
    );
    physicalLayer.addTo(map);

    L.control.layers(
      {
        '① 自然地形図（山脈と川のみ・道路なし）': physicalLayer,
        '② 陰影白地図（山の凹凸のみ・詳細ズーム可）': shadedReliefLayer
      },
      null,
      { position: 'topright' }
    ).addTo(map);

    // 地図上のトーストやフローティングボタンのクリックが地図へ伝播しないよう保護
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

    // 地点丸ピンを強調ポリゴン枠より常に前面に出す専用ペイン
    map.createPane('pinsTopPane');
    map.getPane('pinsTopPane').style.zIndex = String(PIN_MARKER_PANE_Z_INDEX);

    // 2. 常時表示する自然地形（河川ライン・山脈名・大河名）
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

    // 3. 動的レイヤー（段落ごとのエリア枠・地点ピン・クリック時の強調レイヤー）
    const baseAreaGroup = L.layerGroup().addTo(map);
    const pinMarkerGroup = L.layerGroup().addTo(map);
    let activeHighlightLayers = [];
    let currentDirectKeys = [];

    global.addEventListener('resize', () => {
      map.invalidateSize();
    });

    function isPinPlace(p) {
      return Boolean(p && (p.is_pin || (!p.is_area && !p.is_river)));
    }

    function clearHighlights(hideToast = true) {
      activeHighlightLayers.forEach(layer => map.removeLayer(layer));
      activeHighlightLayers = [];
      document.querySelectorAll('.custom-label').forEach(el => {
        el.classList.remove('selected-pin');
      });
      if (hideToast) {
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
     * 指定された地名キー群のうち、地点の丸ピンのみを描画する。
     * ※リロード時・段落切り替え時は事前の青・茶色エリア枠を一切出さず（クリック時のみ枠を表示）、
     *   地図の中心移動・縮尺変更（fitBounds）も行わない。
     */
    function renderPlaceKeys(rawKeysIterable, keepHighlights = false) {
      if (!keepHighlights) {
        clearHighlights(true);
      }
      baseAreaGroup.clearLayers();
      pinMarkerGroup.clearLayers();

      const directSet = new Set(rawKeysIterable || []);
      currentDirectKeys = Array.from(directSet);

      places.filter(p => isPinPlace(p) && directSet.has(p.key)).forEach(place => {
        const fillColor = resolvePinFillColor(place.province);
        const marker = L.circleMarker([place.lat, place.lng], {
          pane: 'pinsTopPane',
          radius: PIN_MARKER_RADIUS_PX,
          fillColor: fillColor,
          color: '#fff',
          weight: PIN_MARKER_BORDER_WEIGHT_PX,
          fillOpacity: 0.95
        }).addTo(pinMarkerGroup);

        marker.bindTooltip(
          `<span class="custom-label" id="pin-label-${escapeHtml(place.key)}">${escapeHtml(localizeName(place.key))}</span>`,
          {
            permanent: true,
            interactive: true,
            direction: 'top',
            offset: [0, PIN_TOOLTIP_OFFSET_Y_PX],
            className: 'transparent-box'
          }
        );
        marker.on('click', () => handleMapItemClick(place.key));
      });
    }

    /**
     * 索引ページの未選択初期状態用：事前のエリア枠は一切出さずクリア状態にする（中心移動なし）。
     */
    function renderOverviewProvinces() {
      clearHighlights(true);
      baseAreaGroup.clearLayers();
      pinMarkerGroup.clearLayers();
      currentDirectKeys = [];
    }

    /**
     * 読者が地名（本文の緑文字・地図ピン・索引項目）を明示的にクリックした時のみ、
     * その地名へ移動し、州全体が見渡せる基準縮尺（ズーム7）でハイライト・トースト表示する。
     */
    function focusPlace(placeKey, clickedRawSurface = '', showToast = true) {
      if (typeof cfg.beforeFocusPlace === 'function') {
        cfg.beforeFocusPlace();
      }
      const found = placeByKey.get(placeKey);
      clearHighlights(false);
      if (!found) return false;

      if (singlePinOnlyOnFocus) {
        renderPlaceKeys([found.key], true);
      } else {
        const keysToShow = new Set(currentDirectKeys);
        keysToShow.add(found.key);
        renderPlaceKeys(keysToShow, true);
      }

      map.invalidateSize();
      map.stop();

      // (A) エリア（州・郡・広域）の場合：領域ポリゴンと中央バナーを表示（最大ズーム7）
      if (found.is_area && found.area_polygon) {
        map.fitBounds(found.area_polygon, {
          padding: [FIT_BOUNDS_PADDING_PX, FIT_BOUNDS_PADDING_PX],
          maxZoom: STATE_STANDARD_ZOOM
        });

        const areaPoly = L.polygon(found.area_polygon, {
          color: '#d84315',
          weight: AREA_HIGHLIGHT_BORDER_WEIGHT_PX,
          fillColor: '#ffab40',
          fillOpacity: 0.25,
          interactive: false
        }).addTo(map);

        const bannerMarker = L.marker([found.lat, found.lng], {
          icon: L.divIcon({
            className: '',
            html: `<span class="area-banner-label">🗺️ ${escapeHtml(localizeName(found.key))}</span>`,
            iconSize: [AREA_BANNER_WIDTH_PX, AREA_BANNER_HEIGHT_PX],
            iconAnchor: [AREA_BANNER_WIDTH_PX / 2, AREA_BANNER_HEIGHT_PX / 2]
          }),
          interactive: false
        }).addTo(map);
        activeHighlightLayers.push(areaPoly, bannerMarker);
      }
      // (B) 河川の場合：基準縮尺ズーム7で移動し、水系ポリラインをハイライト
      else if (found.is_river) {
        map.setView([found.lat, found.lng], STATE_STANDARD_ZOOM, {
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
      }
      // (C) 地点（県・城・関・山）の場合：基準縮尺ズーム7で地点ピンを中心に移動し、親エリア枠＋赤丸を表示
      else {
        const labelEl = document.getElementById(`pin-label-${found.key}`);
        if (labelEl) labelEl.classList.add('selected-pin');

        const parentArea = found.parent_area ? placeByKey.get(found.parent_area) : null;
        if (parentArea && parentArea.is_area && parentArea.area_polygon) {
          const parentPoly = L.polygon(parentArea.area_polygon, {
            color: '#2e7d32',
            weight: PARENT_AREA_BORDER_WEIGHT_PX,
            dashArray: '6, 4',
            fillColor: '#66bb6a',
            fillOpacity: 0.12,
            interactive: false
          }).addTo(map);
          const pLat = parentArea.area_polygon[0][0];
          const pLng = (parentArea.area_polygon[0][1] + parentArea.area_polygon[1][1]) / 2;
          const parentBanner = L.marker([pLat, pLng], {
            icon: L.divIcon({
              className: '',
              html: `<span class="parent-area-banner-label">${escapeHtml(localizeName(parentArea.key))}</span>`,
              iconSize: [PARENT_BANNER_WIDTH_PX, PARENT_BANNER_HEIGHT_PX],
              iconAnchor: [PARENT_BANNER_WIDTH_PX / 2, PARENT_BANNER_HEIGHT_PX / 2]
            }),
            interactive: false
          }).addTo(map);
          activeHighlightLayers.push(parentPoly, parentBanner);
        }

        map.setView([found.lat, found.lng], STATE_STANDARD_ZOOM, {
          animate: true,
          duration: PIN_FOCUS_ANIM_DURATION_SEC
        });

        const ptCircle = L.circle([found.lat, found.lng], {
          radius: SINGLE_PIN_CIRCLE_RADIUS_M,
          color: '#c62828',
          weight: PIN_CIRCLE_BORDER_WEIGHT_PX,
          fillColor: '#ff5252',
          fillOpacity: 0.24,
          interactive: false
        }).addTo(map);
        activeHighlightLayers.push(ptCircle);
      }

      const toastEl = document.getElementById(toastId);
      if (!toastEl) return true;
      if (!showToast) {
        toastEl.style.display = 'none';
        return true;
      }

      const shortTitle = localizeName(found.key, getShortNameWithReading(found.label || found.key));
      const modernText = localizeModern(found.key, found.modern);
      const modernHtml = modernText
        ? ` <span style="font-size:0.8rem; color:#ddd;">（現在の${escapeHtml(modernText)}）</span>`
        : '';
      const inlineActionHtml = typeof cfg.buildToastInlineActionHtml === 'function'
        ? cfg.buildToastInlineActionHtml(found, clickedRawSurface)
        : '';
      const bottomExtraHtml = typeof cfg.buildToastBottomHtml === 'function'
        ? cfg.buildToastBottomHtml(found, clickedRawSurface)
        : '';

      toastEl.innerHTML =
        `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">` +
          `<div>📍 <strong>${escapeHtml(shortTitle)}</strong>${modernHtml}</div>` +
          `<span style="display:inline-flex; align-items:center; gap:6px; margin-left:auto;">` +
            `${inlineActionHtml}` +
            `<button onclick="document.getElementById('${escapeHtml(toastId)}').style.display='none'" style="background:transparent; border:none; color:#ccc; cursor:pointer; font-size:0.9rem; line-height:1; padding:0 2px;" title="閉じる">✕</button>` +
          `</span>` +
        `</div>` +
        `${bottomExtraHtml}`;
      toastEl.style.display = 'block';
      return true;
    }

    // 言語切替時：現在表示中のピン名を選択言語で再描画（中心移動・縮尺変更なし）
    if (global.ThreeKingdomI18n) {
      global.ThreeKingdomI18n.onChange(() => renderPlaceKeys(currentDirectKeys, true));
    }

    return {
      getMap: () => map,
      clearHighlights: clearHighlights,
      renderPlaceKeys: renderPlaceKeys,
      renderOverviewProvinces: renderOverviewProvinces,
      focusPlace: focusPlace
    };
  }

  global.ThreeKingdomMapController = {
    STATE_STANDARD_ZOOM: STATE_STANDARD_ZOOM,
    create: createController
  };
})(window);
