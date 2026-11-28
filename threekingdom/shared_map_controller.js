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

  // 選択した地名（地点ピン・赤名札・エリア強調バナー）を最前面へ出す専用ペイン定数（全巻・総合索引標準仕様）
  // ※ z-index 階段：ポリゴン(400) < 親枠補助バナー(600) < 通常丸ピン(620) < 通常名札(650)
  //                < 選択丸ピン(750) < 選択名札・選択エリアバナー(760) < ズームボタン(1000) < 索引(1500) < ナビ(2000)
  const SELECTED_PIN_PANE_Z_INDEX = 750;        // 選択中の地点丸ピン専用ペインのz-index
  const SELECTED_LABEL_PANE_Z_INDEX = 760;      // 選択中の地点赤名札・選択エリアバナー専用ペインのz-index
  const ENABLE_ALL_VOLUMES_TOP_FOCUS = true;    // 全公開巻・総合索引・今後の全追加巻で常時有効

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

  // 常設の自然地形（山脈・湖沼・大河）および地図UIラベルの4言語辞書
  const NATURE_I18N_MAP = {
    '⛰️ 大別山脈': { zh_tw: '⛰️ 大別山脈', zh_cn: '⛰️ 大别山脉', ko: '⛰️ 대별산맥' },
    '⛰️ 大巴山脈': { zh_tw: '⛰️ 大巴山脈', zh_cn: '⛰️ 大巴山脉', ko: '⛰️ 대파산맥' },
    '⛰️ 太行山脈': { zh_tw: '⛰️ 太行山脈', zh_cn: '⛰️ 太行山脉', ko: '⛰️ 태행산맥' },
    '⛰️ 岷山山脈': { zh_tw: '⛰️ 岷山山脈', zh_cn: '⛰️ 岷山山脉', ko: '⛰️ 민산산맥' },
    '⛰️ 嵩山': { zh_tw: '⛰️ 嵩山', zh_cn: '⛰️ 嵩山', ko: '⛰️ 숭산' },
    '⛰️ 泰山': { zh_tw: '⛰️ 泰山', zh_cn: '⛰️ 泰山', ko: '⛰️ 태산' },
    '⛰️ 秦嶺山脈': { zh_tw: '⛰️ 秦嶺山脈', zh_cn: '⛰️ 秦岭山脉', ko: '⛰️ 진령산맥' },
    '⛰️ 荊山': { zh_tw: '⛰️ 荊山', zh_cn: '⛰️ 荆山', ko: '⛰️ 형산' },
    '⛰️ 隴山': { zh_tw: '⛰️ 隴山', zh_cn: '⛰️ 陇山', ko: '⛰️ 농산' },
    '会稽山脈': { zh_tw: '會稽山脈', zh_cn: '会稽山脉', ko: '회계산맥' },
    '南嶺（五嶺）': { zh_tw: '南嶺（五嶺）', zh_cn: '南岭（五岭）', ko: '남령(오령)' },
    '南嶺・五嶺': { zh_tw: '南嶺・五嶺', zh_cn: '南岭・五岭', ko: '남령·오령' },
    '大別山脈': { zh_tw: '大別山脈', zh_cn: '大别山脉', ko: '대별산맥' },
    '天目山脈': { zh_tw: '天目山脈', zh_cn: '天目山脉', ko: '천목산맥' },
    '太湖（震沢）': { zh_tw: '太湖（震澤）', zh_cn: '太湖（震泽）', ko: '태호(진택)' },
    '太行山脈': { zh_tw: '太行山脈', zh_cn: '太行山脉', ko: '태행산맥' },
    '嵩 山': { zh_tw: '嵩 山', zh_cn: '嵩 山', ko: '숭 산' },
    '嵩山・箕山': { zh_tw: '嵩山・箕山', zh_cn: '嵩山・箕山', ko: '숭산·기산' },
    '彭蠡沢（鄱陽湖）': { zh_tw: '彭蠡澤（鄱陽湖）', zh_cn: '彭蠡泽（鄱阳湖）', ko: '팽례택(파양호)' },
    '桐柏山': { zh_tw: '桐柏山', zh_cn: '桐柏山', ko: '동백산' },
    '汴 水': { zh_tw: '汴 水', zh_cn: '汴 水', ko: '변 수' },
    '沂 水': { zh_tw: '沂 水', zh_cn: '沂 水', ko: '기 수' },
    '泗 水': { zh_tw: '泗 水', zh_cn: '泗 水', ko: '사 수' },
    '泰 山': { zh_tw: '泰 山', zh_cn: '泰 山', ko: '태 산' },
    '淮 水': { zh_tw: '淮 水', zh_cn: '淮 水', ko: '회 수' },
    '淯 水': { zh_tw: '淯 水', zh_cn: '淯 水', ko: '육 수' },
    '渭 水': { zh_tw: '渭 水', zh_cn: '渭 水', ko: '위 수' },
    '漢 水': { zh_tw: '漢 水', zh_cn: '汉 水', ko: '한 수' },
    '漳 水': { zh_tw: '漳 水', zh_cn: '漳 水', ko: '장 수' },
    '秦嶺山脈': { zh_tw: '秦嶺山脈', zh_cn: '秦岭山脉', ko: '진령산맥' },
    '長 江': { zh_tw: '長 江', zh_cn: '长 江', ko: '장 강' },
    '雲夢沢・洞庭湖': { zh_tw: '雲夢澤・洞庭湖', zh_cn: '云梦泽・洞庭湖', ko: '운몽택·동정호' },
    '黄 河': { zh_tw: '黃 河', zh_cn: '黄 河', ko: '황 하' },
    '黄山・皖南山地': { zh_tw: '黃山・皖南山地', zh_cn: '黄山・皖南山地', ko: '황산·완남산지' },
    '🌊 嘉陵江（墊江水）': { zh_tw: '🌊 嘉陵江（墊江水）', zh_cn: '🌊 嘉陵江（垫江水）', ko: '🌊 가릉강(전강수)' },
    '🌊 墊江水（嘉陵江・涪江）': { zh_tw: '🌊 墊江水（嘉陵江・涪江）', zh_cn: '🌊 垫江水（嘉陵江・涪江）', ko: '🌊 전강수(가릉강·부강)' },
    '🌊 渭水': { zh_tw: '🌊 渭水', zh_cn: '🌊 渭水', ko: '🌊 위수' },
    '🌊 漢水': { zh_tw: '🌊 漢水', zh_cn: '🌊 汉水', ko: '🌊 한수' },
    '🌊 漢水（沔水）': { zh_tw: '🌊 漢水（沔水）', zh_cn: '🌊 汉水（沔水）', ko: '🌊 한수(면수)' },
    '🌊 長江（大江）': { zh_tw: '🌊 長江（大江）', zh_cn: '🌊 长江（大江）', ko: '🌊 장강(대강)' },
    '🌊 黄河': { zh_tw: '🌊 黃河', zh_cn: '🌊 黄河', ko: '🌊 황하' },
    '呼沲水（滹沱河）': { zh_tw: '呼沲水（滹沱河）', zh_cn: '呼沲水（滹沱河）', ko: '호타수(호타하)' },
    '嘉陵江（墊江水・閬水）': { zh_tw: '嘉陵江（墊江水・閬水）', zh_cn: '嘉陵江（垫江水・阆水）', ko: '가릉강(전강수·낭수)' },
    '墊江水（嘉陵江・涪江水系：江州〜涪）': { zh_tw: '墊江水（嘉陵江・涪江水系：江州～涪）', zh_cn: '垫江水（嘉陵江・涪江水系：江州～涪）', ko: '전강수(가릉강·부강 수계: 강주~부)' },
    '平虜渠': { zh_tw: '平虜渠', zh_cn: '平虏渠', ko: '평로거' },
    '易水': { zh_tw: '易水', zh_cn: '易水', ko: '역수' },
    '汴水（鴻溝）': { zh_tw: '汴水（鴻溝）', zh_cn: '汴水（鸿沟）', ko: '변수(홍구)' },
    '沂水（沂河）': { zh_tw: '沂水（沂河）', zh_cn: '沂水（沂河）', ko: '기수(기하)' },
    '泉州渠': { zh_tw: '泉州渠', zh_cn: '泉州渠', ko: '천주거' },
    '泒水（大清河水系）': { zh_tw: '泒水（大清河水系）', zh_cn: '泒水（大清河水系）', ko: '고수(대청하 수계)' },
    '泗水': { zh_tw: '泗水', zh_cn: '泗水', ko: '사수' },
    '洹水（安陽河）': { zh_tw: '洹水（安陽河）', zh_cn: '洹水（安阳河）', ko: '원수(안양하)' },
    '浙江（銭塘江・富春江）': { zh_tw: '浙江（錢塘江・富春江）', zh_cn: '浙江（钱塘江・富春江）', ko: '절강(전당강·부춘강)' },
    '淇水（淇河）': { zh_tw: '淇水（淇河）', zh_cn: '淇水（淇河）', ko: '기수(기하)' },
    '淮水（淮河）': { zh_tw: '淮水（淮河）', zh_cn: '淮水（淮河）', ko: '회수(회하)' },
    '淯水（白河）': { zh_tw: '淯水（白河）', zh_cn: '淯水（白河）', ko: '육수(백하)' },
    '淯水（白河：宛〜襄陽で漢水に合流）': { zh_tw: '淯水（白河：自宛至襄陽匯入漢水）', zh_cn: '淯水（白河：自宛至襄阳汇入汉水）', ko: '육수(백하: 완~양양에서 한수에 합류)' },
    '渦水（渦河）': { zh_tw: '渦水（渦河）', zh_cn: '涡水（涡河）', ko: '와수(와하)' },
    '渭水': { zh_tw: '渭水', zh_cn: '渭水', ko: '위수' },
    '渭水（渭河）': { zh_tw: '渭水（渭河）', zh_cn: '渭水（渭河）', ko: '위수(위하)' },
    '滏水（滏陽河）': { zh_tw: '滏水（滏陽河）', zh_cn: '滏水（滏阳河）', ko: '부수(부양하)' },
    '漢水': { zh_tw: '漢水', zh_cn: '汉水', ko: '한수' },
    '漢水（沔水）': { zh_tw: '漢水（沔水）', zh_cn: '汉水（沔水）', ko: '한수(면수)' },
    '漳水（漳河）': { zh_tw: '漳水（漳河）', zh_cn: '漳水（漳河）', ko: '장수(장하)' },
    '潞河（鮑丘水・潮白河／北運河）': { zh_tw: '潞河（鮑丘水・潮白河／北運河）', zh_cn: '潞河（鲍丘水・潮白河／北运河）', ko: '노하(포구수·조백하/북운하)' },
    '白溝': { zh_tw: '白溝', zh_cn: '白沟', ko: '백구' },
    '睢陽渠（睢水）': { zh_tw: '睢陽渠（睢水）', zh_cn: '睢阳渠（睢水）', ko: '수양거(수수)' },
    '肥水': { zh_tw: '肥水', zh_cn: '肥水', ko: '비수' },
    '長江（大江）': { zh_tw: '長江（大江）', zh_cn: '长江（大江）', ko: '장강(대강)' },
    '黄河': { zh_tw: '黃河', zh_cn: '黄河', ko: '황하' }
  };

  const LAYER_LABELS_I18N = {
    ja: ['① 自然地形図（山脈と川のみ・道路なし）', '② 陰影白地図（山の凹凸のみ・詳細ズーム可）'],
    zh_tw: ['① 自然地形圖（僅山脈與河川・無現代道路）', '② 陰影白地圖（山脈起伏・可細部縮放）'],
    zh_cn: ['① 自然地形图（仅山脉与河流・无现代道路）', '② 阴影白地图（山脉起伏・可细部缩放）'],
    ko: ['① 자연지형도 (산맥과 강만 표시·현대 도로 없음)', '② 음영 백지도 (산세 기복·상세 확대 가능)']
  };

  function currentLang() {
    const i18n = global.ThreeKingdomI18n;
    return (i18n && typeof i18n.getLang === 'function') ? i18n.getLang() : 'ja';
  }

  /** 全角・半角カッコ以降の長文説明を切り落とし、地図ピン・バナー用の短い地名だけを返す */
  function stripParenDesc(nameStr) {
    if (!nameStr) return '';
    return String(nameStr).split(/[（(]/)[0].trim();
  }

  function localizePinShortName(key) {
    return stripParenDesc(localizeName(key, key));
  }

  function localizeNatureLabel(rawLabel) {
    const lang = currentLang();
    if (lang === 'ja' || !rawLabel) return rawLabel;
    const hit = NATURE_I18N_MAP[rawLabel];
    return (hit && hit[lang]) ? hit[lang] : rawLabel;
  }

  function formatModernLocationBadge(modernText) {
    if (!modernText) return '';
    const lang = currentLang();
    const clean = String(modernText).trim();
    if (lang === 'ko') {
      const body = /^현재/.test(clean) ? clean : `현재의 ${clean}`;
      return ` <span style="font-size:0.8rem; color:#ddd;">(${escapeHtml(body)})</span>`;
    }
    if (lang === 'zh_tw') {
      const body = /^(?:今|現)/.test(clean) ? clean : `現今${clean}`;
      return ` <span style="font-size:0.8rem; color:#ddd;">（${escapeHtml(body)}）</span>`;
    }
    if (lang === 'zh_cn') {
      const body = /^(?:今|现)/.test(clean) ? clean : `今${clean}`;
      return ` <span style="font-size:0.8rem; color:#ddd;">（${escapeHtml(body)}）</span>`;
    }
    const bodyJa = /^現在/.test(clean) ? clean : `現在の${clean}`;
    return ` <span style="font-size:0.8rem; color:#ddd;">（${escapeHtml(bodyJa)}）</span>`;
  }


  function resolvePinFillColor(provinceName) {
    if (provinceName === '益州' || provinceName === '涼州') return '#2e7d32';
    if (provinceName === '荊州') return '#1565c0';
    if (provinceName === '揚州' || provinceName === '徐州') return '#6a1b9a';
    return '#e65100';
  }

  function isTopFocusEnabled(cfg) {
    if (cfg && typeof cfg.enableTopFocus === 'boolean') return cfg.enableTopFocus;
    if (typeof global !== 'undefined' && global.location && /[?&]top=0\b/.test(String(global.location.search || ''))) {
      return false;
    }
    return ENABLE_ALL_VOLUMES_TOP_FOCUS;
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
    const topFocusEnabled = isTopFocusEnabled(cfg);

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

    let layerControl = null;
    function rebuildLayerControl() {
      if (layerControl) map.removeControl(layerControl);
      const pair = LAYER_LABELS_I18N[currentLang()] || LAYER_LABELS_I18N.ja;
      const baseObj = {};
      baseObj[pair[0]] = physicalLayer;
      baseObj[pair[1]] = shadedReliefLayer;
      layerControl = L.control.layers(baseObj, null, { position: 'topright' }).addTo(map);
    }
    rebuildLayerControl();

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

    // 選択した地点ピン(750)および選択赤名札・選択エリアバナー(760)を他ピン・他名札(650)より一番上に出す専用ペイン
    if (topFocusEnabled) {
      map.createPane('selectedPinTopPane');
      map.getPane('selectedPinTopPane').style.zIndex = String(SELECTED_PIN_PANE_Z_INDEX);
      map.createPane('selectedLabelTopPane');
      map.getPane('selectedLabelTopPane').style.zIndex = String(SELECTED_LABEL_PANE_Z_INDEX);
    }

    // 2. 常時表示する自然地形（河川ライン・山脈名・大河名：4言語動的切替対応）
    const natureGroup = L.layerGroup().addTo(map);
    function renderNatureLayers() {
      natureGroup.clearLayers();
      riverLines.forEach(river => {
        const rLine = L.polyline(river.coords, {
          color: '#1976d2',
          weight: RIVER_BASE_WEIGHT_PX,
          opacity: RIVER_BASE_OPACITY
        }).addTo(natureGroup);
        rLine.bindTooltip(localizeNatureLabel(river.name), { sticky: true });
        if (typeof cfg.onRiverClick === 'function') {
          rLine.on('click', () => cfg.onRiverClick(river.key));
        }
      });

      naturalFeatures.forEach(feat => {
        const dispName = localizeNatureLabel(feat.name);
        const icon = natureLabelMode === 'glossary'
          ? L.divIcon({
              className: '',
              html: `<span class="nat-Geo-label ${feat.type === 'mountain' ? 'mountain' : ''}">${escapeHtml(dispName)}</span>`,
              iconSize: [NATURE_LABEL_WIDTH_PX, NATURE_LABEL_HEIGHT_PX],
              iconAnchor: [NATURE_LABEL_WIDTH_PX / 2, NATURE_LABEL_HEIGHT_PX / 2]
            })
          : L.divIcon({
              className: feat.type === 'mountain' ? 'nature-label-mountain' : 'nature-label-river',
              html: escapeHtml(dispName),
              iconSize: [NATURE_LABEL_WIDTH_PX, NATURE_LABEL_HEIGHT_PX],
              iconAnchor: [NATURE_LABEL_WIDTH_PX / 2, NATURE_LABEL_HEIGHT_PX / 2]
            });
        L.marker([feat.lat, feat.lng], { icon: icon, interactive: false }).addTo(natureGroup);
      });
    }
    renderNatureLayers();

    // 3. 動的レイヤー（段落ごとのエリア枠・地点ピン・クリック時の強調レイヤー）
    const baseAreaGroup = L.layerGroup().addTo(map);
    const pinMarkerGroup = L.layerGroup().addTo(map);
    let activeHighlightLayers = [];
    let currentDirectKeys = [];
    let activeSelectedPinKey = '';
    let lastFocusedState = null;

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
        activeSelectedPinKey = '';
        lastFocusedState = null;
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
     * 他のピン・名札はそのまま維持し、選択中の地点ピン＆赤名札のみ最前面ペインへ配置する。
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
        const isSelected = topFocusEnabled && place.key === activeSelectedPinKey;
        const fillColor = resolvePinFillColor(place.province);
        const selCls = place.key === activeSelectedPinKey ? ' selected-pin' : '';
        const marker = L.circleMarker([place.lat, place.lng], {
          pane: isSelected ? 'selectedPinTopPane' : 'pinsTopPane',
          radius: PIN_MARKER_RADIUS_PX,
          fillColor: fillColor,
          color: '#fff',
          weight: PIN_MARKER_BORDER_WEIGHT_PX,
          fillOpacity: 0.95
        }).addTo(pinMarkerGroup);

        const tooltipOptions = {
          permanent: true,
          interactive: true,
          direction: 'top',
          offset: [0, PIN_TOOLTIP_OFFSET_Y_PX],
          className: 'transparent-box'
        };
        if (isSelected) {
          tooltipOptions.pane = 'selectedLabelTopPane';
        }

        marker.bindTooltip(
          `<span class="custom-label${selCls}" id="pin-label-${escapeHtml(place.key)}">${escapeHtml(localizePinShortName(place.key))}</span>`,
          tooltipOptions
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
      activeSelectedPinKey = isPinPlace(found) ? found.key : '';

      if (singlePinOnlyOnFocus) {
        renderPlaceKeys([found.key], true);
      } else {
        const keysToShow = new Set(currentDirectKeys);
        keysToShow.add(found.key);
        renderPlaceKeys(keysToShow, true);
      }

      map.invalidateSize();
      map.stop();

      // (A) エリア（州・郡・広域）の場合：領域ポリゴンと中央バナーを表示（最大ズーム7、バナーは最前面ペイン）
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

        const bannerOpts = {
          icon: L.divIcon({
            className: '',
            html: `<span class="area-banner-label">🗺️ ${escapeHtml(localizePinShortName(found.key))}</span>`,
            iconSize: [AREA_BANNER_WIDTH_PX, AREA_BANNER_HEIGHT_PX],
            iconAnchor: [AREA_BANNER_WIDTH_PX / 2, AREA_BANNER_HEIGHT_PX / 2]
          }),
          interactive: false
        };
        if (topFocusEnabled) {
          bannerOpts.pane = 'selectedLabelTopPane';
        }
        const bannerMarker = L.marker([found.lat, found.lng], bannerOpts).addTo(map);
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
              html: `<span class="parent-area-banner-label">${escapeHtml(localizePinShortName(parentArea.key))}</span>`,
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

      lastFocusedState = { placeKey: found.key, surface: clickedRawSurface };
      const shortTitle = currentLang() === 'ja'
        ? getShortNameWithReading(found.label || found.key)
        : localizePinShortName(found.key);
      const modernText = localizeModern(found.key, found.modern);
      const modernHtml = formatModernLocationBadge(modernText);
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
            `<button onclick="document.getElementById('${escapeHtml(toastId)}').style.display='none'" style="background:transparent; border:none; color:#ccc; cursor:pointer; font-size:0.9rem; line-height:1; padding:0 2px;" title="Close">✕</button>` +
          `</span>` +
        `</div>` +
        `${bottomExtraHtml}`;
      toastEl.style.display = 'block';
      return true;
    }

    // 言語切替時：自然地形・レイヤー名・現在表示中のピン名・表示中トーストを選択言語で再描画
    if (global.ThreeKingdomI18n) {
      global.ThreeKingdomI18n.onChange(() => {
        rebuildLayerControl();
        renderNatureLayers();
        renderPlaceKeys(currentDirectKeys, true);
        const toastEl = document.getElementById(toastId);
        if (lastFocusedState && toastEl && toastEl.style.display !== 'none') {
          const f = placeByKey.get(lastFocusedState.placeKey);
          if (f) {
            const st = currentLang() === 'ja'
              ? getShortNameWithReading(f.label || f.key)
              : localizePinShortName(f.key);
            const mh = formatModernLocationBadge(localizeModern(f.key, f.modern));
            const ia = typeof cfg.buildToastInlineActionHtml === 'function'
              ? cfg.buildToastInlineActionHtml(f, lastFocusedState.surface)
              : '';
            const bx = typeof cfg.buildToastBottomHtml === 'function'
              ? cfg.buildToastBottomHtml(f, lastFocusedState.surface)
              : '';
            toastEl.innerHTML =
              `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">` +
                `<div>📍 <strong>${escapeHtml(st)}</strong>${mh}</div>` +
                `<span style="display:inline-flex; align-items:center; gap:6px; margin-left:auto;">` +
                  `${ia}` +
                  `<button onclick="document.getElementById('${escapeHtml(toastId)}').style.display='none'" style="background:transparent; border:none; color:#ccc; cursor:pointer; font-size:0.9rem; line-height:1; padding:0 2px;" title="Close">✕</button>` +
                `</span>` +
              `</div>` +
              `${bx}`;
          }
        }
      });
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
