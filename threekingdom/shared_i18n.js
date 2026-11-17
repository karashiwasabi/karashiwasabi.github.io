// -*- coding: utf-8 -*-
/**
 * 『正史三國志』4言語（日 / 繁 / 簡 / 韓）切替 共通フレームワーク（shared_i18n.js）
 *
 * 【固定仕様（PROJECT_RULES.md 第9節）】
 * 1. 言語コードは ja / zh_tw / zh_cn / ko（初期値 ja）。localStorage キー threekingdom_selected_lang で全ページ共有。
 * 2. ja は現行どおり「原文＋書き下し文＋現代日本語訳」の3段（現行出力と100%同一）。
 *    zh_tw / zh_cn / ko は「原文＋現代語訳」の2段（書き下し段は非表示）。
 * 3. 翻訳データ（window.THREEKINGDOM_I18N：shared_i18n_data.js）が無いレコード・辞書項目は
 *    原文＋日本語訳（または日本語キー）へ安全にフォールバックする。
 * 4. 内部マスターキー KEY は日本語キー1本に統一し、表示名（SURFACE・地名ラベル）のみ言語別に差し替える。
 */
(function (global) {
  'use strict';

  const LANG_STORAGE_KEY = 'threekingdom_selected_lang'; // 全ページ共有の言語保存キー
  const DEFAULT_LANG = 'ja';                              // 初期言語
  const SWITCH_FONT_SIZE_REM = 0.78;                      // 言語ボタンの文字サイズ(rem)
  const SWITCH_BTN_PADDING = '2px 8px';                   // 言語ボタンの余白（スリム1行バーに収める）
  const SWITCH_BTN_GAP_PX = 3;                            // 言語ボタン間の間隔(px)

  const LANGS = [
    { code: 'ja',    label: '日', title: '日本語',   htmlLang: 'ja' },
    { code: 'zh_tw', label: '繁', title: '繁體中文', htmlLang: 'zh-Hant' },
    { code: 'zh_cn', label: '簡', title: '简体中文', htmlLang: 'zh-Hans' },
    { code: 'ko',    label: '韓', title: '한국어',   htmlLang: 'ko' }
  ];
  // 言語切替バーを自動マウントする既存の上部スリムバーID（本編：paraTopNav／索引：rightTopBar）
  const HOST_BAR_IDS = ['paraTopNav', 'rightTopBar'];
  // 言語切替時に再描画する既存ページ側のグローバル関数名（存在するもののみ呼ぶ）
  const RERENDER_FN_NAMES = ['renderReaderList', 'renderIndexCatalogList', 'renderRightResultPane'];
  const TYPE_TO_DATA_KEY = { place: 'places', person: 'persons', office: 'offices', special: 'specials' };
  const FALLBACK_NOTE = {
    zh_tw: '（此段尚未翻譯，暫以日文譯文顯示）',
    zh_cn: '（此段尚未翻译，暂以日文译文显示）',
    ko: '(이 단락은 아직 번역되지 않아 일본어 번역을 표시합니다)'
  };

  const DATA = global.THREEKINGDOM_I18N || {};
  const listeners = [];

  function isValidLang(code) {
    return LANGS.some(l => l.code === code);
  }

  function getLang() {
    try {
      const saved = global.localStorage.getItem(LANG_STORAGE_KEY);
      if (isValidLang(saved)) return saved;
    } catch (e) { /* localStorage 不可環境は初期値 */ }
    return DEFAULT_LANG;
  }

  /** 辞書項目（place/person/office/special）の表示名を返す。未翻訳は fallback、無ければ日本語キー。 */
  function localName(type, key, fallback) {
    const base = fallback !== undefined && fallback !== null ? fallback : key;
    const lang = getLang();
    if (lang === DEFAULT_LANG) return base;
    const table = DATA[TYPE_TO_DATA_KEY[type]] || {};
    const entry = table[key] && table[key][lang];
    return entry && entry.name ? entry.name : base;
  }

  /** 地名の「現在の場所」文字列。未翻訳は fallback。 */
  function localPlaceModern(key, fallback) {
    const lang = getLang();
    if (lang === DEFAULT_LANG) return fallback;
    const table = DATA.places || {};
    const entry = table[key] && table[key][lang];
    return entry && entry.modern ? entry.modern : fallback;
  }

  /**
   * 本文カード内の段構成HTMLを返す。
   * @param {Object} rec レコード
   * @param {Function} renderTags タグ付き文字列→HTML の既存描画関数
   */
  function renderCardBody(rec, renderTags) {
    const lang = getLang();
    if (lang === DEFAULT_LANG) {
      // 現行品質100%維持：従来の3段をそのまま出力
      return `
        <div class="raw-text">${renderTags(rec.raw_tagged)}</div>
        <div class="kakikudashi">${renderTags(rec.kakikudashi_tagged)}</div>
        <div class="translation">${renderTags(rec.translation_tagged)}</div>
      `;
    }
    const tr = (DATA.records && DATA.records[rec.id] && DATA.records[rec.id][lang]) || null;
    const rawTagged = tr && tr.raw_tagged ? tr.raw_tagged : rec.raw_tagged;
    if (tr && tr.translation_tagged) {
      return `
        <div class="raw-text">${renderTags(rawTagged)}</div>
        <div class="translation">${renderTags(tr.translation_tagged)}</div>
      `;
    }
    // 未翻訳：原文＋日本語訳で安全にフォールバック
    return `
        <div class="raw-text">${renderTags(rawTagged)}</div>
        <div class="translation">${renderTags(rec.translation_tagged)}</div>
        <div class="i18n-fallback-note">${FALLBACK_NOTE[lang] || ''}</div>
      `;
  }

  function injectStyle() {
    if (document.getElementById('i18nSwitchStyle')) return;
    const st = document.createElement('style');
    st.id = 'i18nSwitchStyle';
    st.textContent =
      `.lang-switch{display:inline-flex;gap:${SWITCH_BTN_GAP_PX}px;margin-left:auto;flex-shrink:0;}` +
      `.lang-btn{background:transparent;border:1px solid #8c6d46;color:#f7f1e5;border-radius:4px;` +
      `padding:${SWITCH_BTN_PADDING};font-size:${SWITCH_FONT_SIZE_REM}rem;cursor:pointer;line-height:1.2;}` +
      `.lang-btn.active{background:#d4af37;color:#2c241b;font-weight:bold;border-color:#d4af37;}` +
      `.i18n-fallback-note{font-size:0.74rem;color:#8d6e63;margin-top:4px;}`;
    document.head.appendChild(st);
  }

  function buildSwitch() {
    const cur = getLang();
    const wrap = document.createElement('span');
    wrap.className = 'lang-switch';
    wrap.setAttribute('role', 'group');
    LANGS.forEach(l => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-btn' + (l.code === cur ? ' active' : '');
      btn.textContent = l.label;
      btn.title = l.title;
      btn.addEventListener('click', () => setLang(l.code));
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function refreshSwitches() {
    document.querySelectorAll('.lang-switch').forEach(el => {
      const fresh = buildSwitch();
      el.replaceWith(fresh);
    });
  }

  function setLang(code) {
    if (!isValidLang(code)) return;
    try { global.localStorage.setItem(LANG_STORAGE_KEY, code); } catch (e) { /* 保存不可でも表示は切替 */ }
    const meta = LANGS.find(l => l.code === code);
    document.documentElement.lang = meta.htmlLang;
    refreshSwitches();
    RERENDER_FN_NAMES.forEach(name => {
      if (typeof global[name] === 'function') global[name]();
    });
    listeners.forEach(cb => cb(code));
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.push(cb);
  }

  /** 上部スリムバーの右端へ言語切替ボタンを常駐させる（バー内容が再描画されても自動再装着）。 */
  function mountOnHost(host) {
    const ensure = () => {
      if (!host.querySelector('.lang-switch')) host.appendChild(buildSwitch());
    };
    ensure();
    new MutationObserver(ensure).observe(host, { childList: true });
  }

  function init() {
    injectStyle();
    const meta = LANGS.find(l => l.code === getLang());
    document.documentElement.lang = meta.htmlLang;
    HOST_BAR_IDS.forEach(id => {
      const host = document.getElementById(id);
      if (host) mountOnHost(host);
    });
    // 保存済み言語が ja 以外の場合、ページ側の初期描画後に再描画して反映
    if (getLang() !== DEFAULT_LANG) {
      RERENDER_FN_NAMES.forEach(name => {
        if (typeof global[name] === 'function') global[name]();
      });
    }
  }

  global.ThreeKingdomI18n = {
    LANGS: LANGS,
    getLang: getLang,
    setLang: setLang,
    onChange: onChange,
    localName: localName,
    localPlaceModern: localPlaceModern,
    renderCardBody: renderCardBody,
    init: init
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    // ページ側スクリプト（末尾で renderReaderList 等を初回実行）より後に初期化する
    global.addEventListener('load', init);
  }
})(typeof window !== 'undefined' ? window : globalThis);
