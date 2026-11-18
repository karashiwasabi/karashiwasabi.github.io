// -*- coding: utf-8 -*-
/**
 * 『正史三國志』UIラベル 4言語辞書（shared_i18n_ui.js）
 * shared_i18n.js の後に読み込み、window.ThreeKingdomI18n へ UI 文言用の関数を追加する。
 *
 * - t(key, params, fallback)   : UI文言（{p} 等のプレースホルダ置換付き）。ja の値は従来HTMLの文言と同一。
 * - typeLabel / volLabel / sectionTitle / categoryLabel / localDesc : データ由来ラベルの言語別表示（未翻訳は日本語）。
 * - applyStaticUi()            : 静的HTML（data-i18n 属性・巻選択 <select> の選択肢）を選択言語へ書き換える。
 */
(function (global) {
  'use strict';

  const I18N = global.ThreeKingdomI18n;
  if (!I18N) return;
  const DATA = global.THREEKINGDOM_I18N || {};

  const UI = {
    home:           { ja: '🏠 トップ', zh_tw: '🏠 首頁', zh_cn: '🏠 首页', ko: '🏠 홈' },
    volSelectTitle: { ja: '巻・索引を切り替え', zh_tw: '切換卷・索引', zh_cn: '切换卷・索引', ko: '권·색인 전환' },
    paraLabel:      { ja: '第 {p} / {d}', zh_tw: '第 {p} / {d}', zh_cn: '第 {p} / {d}', ko: '제 {p} / {d}' },
    paraParen:      { ja: '（第{p}段落）', zh_tw: '（第{p}段）', zh_cn: '（第{p}段）', ko: '(제{p}단락)' },
    paraParenType:  { ja: '（第{p}段落・{type}）', zh_tw: '（第{p}段・{type}）', zh_cn: '（第{p}段・{type}）', ko: '(제{p}단락·{type})' },
    catPerson:      { ja: '【人物】', zh_tw: '【人物】', zh_cn: '【人物】', ko: '【인물】' },
    catOffice:      { ja: '【官職】', zh_tw: '【官職】', zh_cn: '【官职】', ko: '【관직】' },
    descPerson:     { ja: '📖 【人物・史料解説】', zh_tw: '📖 【人物・史料解說】', zh_cn: '📖 【人物・史料解说】', ko: '📖 【인물·사료 해설】' },
    descOffice:     { ja: '📖 【官職・制度解説】', zh_tw: '📖 【官職・制度解說】', zh_cn: '📖 【官职・制度解说】', ko: '📖 【관직·제도 해설】' },
    descTerm:       { ja: '📖 【語句・故事の意味解説】', zh_tw: '📖 【詞語・典故釋義】', zh_cn: '📖 【词语・典故释义】', ko: '📖 【어구·고사 해설】' },
    descTermFallback: { ja: '📖 【語句・制度の意味解説】', zh_tw: '📖 【詞語・制度釋義】', zh_cn: '📖 【词语・制度释义】', ko: '📖 【어구·제도 해설】' },
    occList:        { ja: '📖 登場箇所一覧', zh_tw: '📖 出場位置一覽', zh_cn: '📖 出场位置一览', ko: '📖 등장 위치 목록' },
    occListAll:     { ja: '📖 全巻登場箇所一覧', zh_tw: '📖 全卷出場位置一覽', zh_cn: '📖 全卷出场位置一览', ko: '📖 전권 등장 위치 목록' },
    occInVol:       { ja: '📖 {v} での登場箇所', zh_tw: '📖 {v} 中的出場位置', zh_cn: '📖 {v} 中的出场位置', ko: '📖 {v}의 등장 위치' },
    allVolsBtn:     { ja: '📚 全巻', zh_tw: '📚 全卷', zh_cn: '📚 全卷', ko: '📚 전권' },
    jumpHere:       { ja: 'この段落へ移動して読む', zh_tw: '移至此段閱讀', zh_cn: '移至此段阅读', ko: '이 단락으로 이동해 읽기' },
    jumpOtherVol:   { ja: '📖 {v}へ移動して読む ↗', zh_tw: '📖 前往 {v} 閱讀 ↗', zh_cn: '📖 前往 {v} 阅读 ↗', ko: '📖 {v}(으)로 이동해 읽기 ↗' },
    noOcc:          { ja: '該当する出現箇所はありません。', zh_tw: '沒有對應的出場位置。', zh_cn: '没有对应的出场位置。', ko: '해당하는 등장 위치가 없습니다.' },
    nowReading:     { ja: '👈 【現在読書中の行】', zh_tw: '👈 【目前閱讀中】', zh_cn: '👈 【当前阅读中】', ko: '👈 【현재 읽는 중】' },
    homonymAlert:   { ja: '⚠️ 同姓同名・同名異人の別人物が存在します（史料考証に基づき分離済み）', zh_tw: '⚠️ 存在同姓同名的其他人物（已依史料考證分開）', zh_cn: '⚠️ 存在同姓同名的其他人物（已依史料考证分开）', ko: '⚠️ 동명이인이 존재합니다 (사료 고증에 따라 분리됨)' },
    viewPerson:     { ja: '{n} を見る ➔', zh_tw: '查看 {n} ➔', zh_cn: '查看 {n} ➔', ko: '{n} 보기 ➔' },
    wikiLoading:    { ja: '🌐 Wikipediaから「{n}」の概略を取得中...', zh_tw: '🌐 正在從維基百科取得「{n}」概要...', zh_cn: '🌐 正在从维基百科获取「{n}」概要...', ko: '🌐 위키백과에서「{n}」개요를 가져오는 중...' },
    backSpot:       { ja: '↩ さっき読んでいた場所 ({id}) に戻る', zh_tw: '↩ 回到剛才閱讀的位置 ({id})', zh_cn: '↩ 回到刚才阅读的位置 ({id})', ko: '↩ 방금 읽던 위치 ({id})로 돌아가기' },
    backIndex:      { ja: '↩ さっき開いていた索引（{v}）に戻る', zh_tw: '↩ 回到剛才開啟的索引（{v}）', zh_cn: '↩ 回到刚才打开的索引（{v}）', ko: '↩ 방금 열었던 색인({v})으로 돌아가기' },
    backVolSpot:    { ja: '↩ さっき読んでいた場所（{v} 第{p}段落 [{id}]）に戻る', zh_tw: '↩ 回到剛才閱讀的位置（{v} 第{p}段 [{id}]）', zh_cn: '↩ 回到刚才阅读的位置（{v} 第{p}段 [{id}]）', ko: '↩ 방금 읽던 위치({v} 제{p}단락 [{id}])로 돌아가기' },
    closeBtn:       { ja: '✕ 閉じる', zh_tw: '✕ 關閉', zh_cn: '✕ 关闭', ko: '✕ 닫기' },
    sponsor:        { ja: 'スポンサーリンク', zh_tw: '贊助連結', zh_cn: '赞助链接', ko: '스폰서 링크' },
    glossaryOption: { ja: '📑 登場人物・地名・官職 索引', zh_tw: '📑 人物・地名・官職 索引', zh_cn: '📑 人物・地名・官职 索引', ko: '📑 인물·지명·관직 색인' },
    // 総合索引ページ（glossary.html / index.html）用UI文言
    searchPlaceholder: { ja: '🔍 名前・よみがな・地名・官職で検索', zh_tw: '🔍 搜尋姓名・讀音・地名・官職', zh_cn: '🔍 搜索姓名・读音・地名・官职', ko: '🔍 이름·독음·지명·관직으로 검색' },
    mapPeekBtn:        { ja: '🗺️ 地図', zh_tw: '🗺️ 地圖', zh_cn: '🗺️ 地图', ko: '🗺️ 지도' },
    tabPerson:         { ja: '👤 人物', zh_tw: '👤 人物', zh_cn: '👤 人物', ko: '👤 인물' },
    tabPlace:          { ja: '📍 地名', zh_tw: '📍 地名', zh_cn: '📍 地名', ko: '📍 지명' },
    tabOffice:         { ja: '👑 官職', zh_tw: '👑 官職', zh_cn: '👑 官职', ko: '👑 관직' },
    tabSpecial:        { ja: '🔖 用語', zh_tw: '🔖 用語', zh_cn: '🔖 词语', ko: '🔖 용어' },
    backToList:        { ja: '← 索引一覧に戻る', zh_tw: '← 返回索引一覽', zh_cn: '← 返回索引一览', ko: '← 색인 목록으로 돌아가기' },
    backPrevItem:      { ja: '↩ ひとつ前の項目に戻る', zh_tw: '↩ 返回上一項目', zh_cn: '↩ 返回上一项目', ko: '↩ 이전 항목으로 돌아가기' },
    reopenIndexBtn:    { ja: '📑 索引', zh_tw: '📑 索引', zh_cn: '📑 索引', ko: '📑 색인' },
    glossaryHeader:    { ja: '📑 登場人物・地名・官職 索引', zh_tw: '📑 登場人物・地名・官職 索引', zh_cn: '📑 登场人物・地名・官职 索引', ko: '📑 등장인물·지명·관직 색인' },
    resumeTitle:       { ja: '前回のしおり：', zh_tw: '上次的書籤：', zh_cn: '上次的书签：', ko: '이전 북마크:' },
    resumeBtn:         { ja: '前回の続きを読む ➔', zh_tw: '繼續閱讀上次進度 ➔', zh_cn: '继续阅读上次进度 ➔', ko: '이전 읽던 부분 계속 읽기 ➔' },
    guideTitle:        { ja: '🔍 検索・索引から調べる', zh_tw: '🔍 透過搜尋・索引查閱', zh_cn: '🔍 通过搜索・索引查阅', ko: '🔍 검색·색인에서 찾기' },
    guideDesc1:        { ja: '索引（<strong>人物</strong> ／ <strong>地名</strong> ／ <strong>官職</strong> ／ <strong>用語</strong>）から調べたい項目を押してください。', zh_tw: '請從索引（<strong>人物</strong> ／ <strong>地名</strong> ／ <strong>官職</strong> ／ <strong>用語</strong>）點選想查閱的項目。', zh_cn: '请从索引（<strong>人物</strong> ／ <strong>地名</strong> ／ <strong>官职</strong> ／ <strong>词语</strong>）点击想查阅的項目。', ko: '색인(<strong>인물</strong> / <strong>지명</strong> / <strong>관직</strong> / <strong>용어</strong>)에서 찾고자 하는 항목을 선택하세요.' },
    guideDesc2:        { ja: '先頭に <strong>Wikipediaと史料解説</strong> が出たのち、<strong>第1巻から最終巻まで一致する本文</strong> が順番に並び、本文中の地名を押すと地図で場所を確認できます。', zh_tw: '開頭為<strong>史料解說</strong>，其後按序排列<strong>自第1卷至最終卷符合的本文</strong>，點擊文中古地名可在地圖上確認位置。', zh_cn: '开头为<strong>史料解说</strong>，其后按序排列<strong>自第1卷至最终卷符合的本文</strong>，点击文中古地名可在地图上确认位置。', ko: '첫머리에 <strong>사료 해설</strong>이 표시된 뒤, <strong>제1권부터 최종권까지 일치하는 본문</strong>이 순서대로 나열되며 본문 속 지명을 누르면 지도에서 위치를 확인할 수 있습니다.' },
    tryQuick:          { ja: '💡 すぐ試す：', zh_tw: '💡 快速體驗：', zh_cn: '💡 快速体验：', ko: '💡 바로 시험해보기:' },
    readVolumesTitle:  { ja: '📚 各巻の本編を通読する', zh_tw: '📚 通讀各卷正文', zh_cn: '📚 通读各卷正文', ko: '📚 각 권 본문 통독하기' },
    officeCentral:     { ja: '① 中央の官職', zh_tw: '① 中央官職', zh_cn: '① 中央官职', ko: '① 중앙 관직' },
    officeMilitary:    { ja: '② 軍の官職', zh_tw: '② 軍事官職', zh_cn: '② 军事官职', ko: '② 군사 관직' },
    officeLocal:       { ja: '③ 地方の官職', zh_tw: '③ 地方官職', zh_cn: '③ 地方官职', ko: '③ 지방 관직' },
    officeTitle:       { ja: '④ 爵位・特権', zh_tw: '④ 爵位・特權', zh_cn: '④ 爵位・特权', ko: '④ 작위·특권' },
    specialSource:     { ja: '📚 引用史料・典籍', zh_tw: '📚 引用史料・典籍', zh_cn: '📚 引用史料・典籍', ko: '📚 인용 사료·전적' },
    specialTerm:       { ja: '🔖 歴史用語・年号・故事', zh_tw: '🔖 歷史名詞・年號・典故', zh_cn: '🔖 历史名词・年号・典故', ko: '🔖 역사 용어·연호·고사' },
    noSearchResults:   { ja: '「{n}」に一致する項目は見つかりませんでした。', zh_tw: '找不到與「{n}」相符的項目。', zh_cn: '找不到与「{n}」匹配的項目。', ko: '「{n}」와(과) 일치하는 항목을 찾을 수 없습니다.' },
    noItems:           { ja: '該当する項目はありません。', zh_tw: '沒有符合的項目。', zh_cn: '没有符合的項目。', ko: '해당하는 항목이 없습니다.' },
    descHead:          { ja: '📖 史料・事典解説', zh_tw: '📖 史料・辭典解說', zh_cn: '📖 史料・辞典解说', ko: '📖 사료·사전 해설' },
    refocusPlaceBtn:   { ja: '🗺️ 地図でこの場所を再フォーカス', zh_tw: '🗺️ 在地圖上重新聚焦此地點', zh_cn: '🗺️ 在地图上重新聚焦此地点', ko: '🗺️ 지도에서 이 장소 다시 포커스' },
    readInVolBtn:      { ja: '📖 この段落から本編を読む', zh_tw: '📖 從此段閱讀正文', zh_cn: '📖 从此段阅读正文', ko: '📖 이 단락부터 본문 읽기' },
    jumpPlaceToast:    { ja: '📑 この地名の記事へ', zh_tw: '📑 前往此地名條目', zh_cn: '📑 前往此地名条目', ko: '📑 이 지명 항목으로' }
  };

  const TYPE_LABELS = {
    '本文': { ja: '本文', zh_tw: '本文', zh_cn: '本文', ko: '본문' },
    '裴注': { ja: '裴注', zh_tw: '裴注', zh_cn: '裴注', ko: '배주' }
  };

  // 巻選択 <select> の選択肢（value=ファイル名）と巻の短縮ラベル（日本語短縮ラベルをキーに言語別表示）
  const VOL_OPTION_LABELS = {
    'vol01.html': { ja: '魏書一　武帝紀', zh_tw: '魏書一　武帝紀', zh_cn: '魏书一　武帝纪', ko: '위서1　무제기' },
    'vol17.html': { ja: '魏書十七　張樂于張徐傳', zh_tw: '魏書十七　張樂于張徐傳', zh_cn: '魏书十七　张乐于张徐传', ko: '위서17　장악우장서전' },
    'vol31.html': { ja: '蜀書一　劉二牧傳', zh_tw: '蜀書一　劉二牧傳', zh_cn: '蜀书一　刘二牧传', ko: '촉서1　유이목전' },
    'vol35.html': { ja: '蜀書五　諸葛亮傳', zh_tw: '蜀書五　諸葛亮傳', zh_cn: '蜀书五　诸葛亮传', ko: '촉서5　제갈량전' },
    'vol36.html': { ja: '蜀書六　關張馬黃趙傳', zh_tw: '蜀書六　關張馬黃趙傳', zh_cn: '蜀书六　关张马黄赵传', ko: '촉서6　관장마황조전' },
    'vol46.html': { ja: '呉書一　孫破虜討逆傳', zh_tw: '吳書一　孫破虜討逆傳', zh_cn: '吴书一　孙破虏讨逆传', ko: '오서1　손파로토역전' },
    'vol54.html': { ja: '呉書九　周瑜魯粛呂蒙傳', zh_tw: '吳書九　周瑜魯肅呂蒙傳', zh_cn: '吴书九　周瑜鲁肃吕蒙传', ko: '오서9　주유노숙여몽전' }
  };
  const VOL_SHORT_LABELS = {
    '魏書一 武帝紀':         { zh_tw: '魏書一 武帝紀', zh_cn: '魏书一 武帝纪', ko: '위서1 무제기' },
    '魏書十七 五将軍伝':     { zh_tw: '魏書十七 五將軍傳', zh_cn: '魏书十七 五将军传', ko: '위서17 오장군전' },
    '蜀書一 劉二牧伝':       { zh_tw: '蜀書一 劉二牧傳', zh_cn: '蜀书一 刘二牧传', ko: '촉서1 유이목전' },
    '蜀書五 諸葛亮伝':       { zh_tw: '蜀書五 諸葛亮傳', zh_cn: '蜀书五 诸葛亮传', ko: '촉서5 제갈량전' },
    '蜀書六 関張馬黄趙伝':   { zh_tw: '蜀書六 關張馬黃趙傳', zh_cn: '蜀书六 关张马黄赵传', ko: '촉서6 관장마황조전' },
    '呉書一 孫堅孫策伝':     { zh_tw: '吳書一 孫堅孫策傳', zh_cn: '吴书一 孙坚孙策传', ko: '오서1 손견손책전' },
    '呉書九 周瑜魯粛呂蒙伝': { zh_tw: '吳書九 周瑜魯肅呂蒙傳', zh_cn: '吴书九 周瑜鲁肃吕蒙传', ko: '오서9 주유노숙여몽전' },
    '魏書一　武帝紀':         { zh_tw: '魏書一　武帝紀', zh_cn: '魏书一　武帝纪', ko: '위서1　무제기' },
    '魏書十七　張樂于張徐傳': { zh_tw: '魏書十七　張樂于張徐傳', zh_cn: '魏书十七　张乐于张徐传', ko: '위서17　장악우장서전' },
    '蜀書一　劉二牧傳':       { zh_tw: '蜀書一　劉二牧傳', zh_cn: '蜀书一　刘二牧传', ko: '촉서1　유이목전' },
    '蜀書五　諸葛亮傳':       { zh_tw: '蜀書五　諸葛亮傳', zh_cn: '蜀书五　诸葛亮传', ko: '촉서5　제갈량전' },
    '蜀書六　關張馬黃趙傳':   { zh_tw: '蜀書六　關張馬黃趙傳', zh_cn: '蜀书六　关张马黄赵传', ko: '촉서6　관장마황조전' },
    '呉書一　孫破虜討逆傳':   { zh_tw: '吳書一　孫破虜討逆傳', zh_cn: '吴书一　孙破虏讨逆传', ko: '오서1　손파로토역전' },
    '呉書九　周瑜魯粛呂蒙傳': { zh_tw: '吳書九　周瑜魯肅呂蒙傳', zh_cn: '吴书九　周瑜鲁肃吕蒙传', ko: '오서9　주유노숙여몽전' },
    '魏書一':   { zh_tw: '魏書一', zh_cn: '魏书一', ko: '위서1' },
    '魏書十七': { zh_tw: '魏書十七', zh_cn: '魏书十七', ko: '위서17' },
    '蜀書一':   { zh_tw: '蜀書一', zh_cn: '蜀书一', ko: '촉서1' },
    '蜀書五':   { zh_tw: '蜀書五', zh_cn: '蜀书五', ko: '촉서5' },
    '蜀書六':   { zh_tw: '蜀書六', zh_cn: '蜀书六', ko: '촉서6' },
    '呉書一':   { zh_tw: '吳書一', zh_cn: '吴书一', ko: '오서1' },
    '呉書九':   { zh_tw: '吳書九', zh_cn: '吴书九', ko: '오서9' }
  };

  function fill(template, params) {
    return String(template).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? params[k] : m));
  }

  function t(key, params, fallback) {
    const entry = UI[key];
    if (!entry) return fallback !== undefined ? fallback : key;
    return fill(entry[I18N.getLang()] || entry.ja, params);
  }

  function pick(table, key) {
    const lang = I18N.getLang();
    if (lang === 'ja') return undefined;
    const e = table && table[key];
    return e && e[lang] ? e[lang] : undefined;
  }

  function typeLabel(type) {
    const e = TYPE_LABELS[type];
    return e ? (e[I18N.getLang()] || e.ja) : type;
  }

  function volLabel(jaShortLabel) {
    return pick(VOL_SHORT_LABELS, jaShortLabel) || jaShortLabel;
  }

  function sectionTitle(jaTitle) {
    return pick(DATA.sections, jaTitle) || jaTitle;
  }

  /** 用語カテゴリ（例：礼制・祭祀）を【】付きで返す。未翻訳は日本語カテゴリのまま。 */
  function categoryLabel(jaCategory) {
    return '【' + (pick(DATA.categories, jaCategory) || jaCategory) + '】';
  }

  /** 辞書解説文（ai_desc / 地名比定地）。未翻訳は日本語の解説をそのまま返す。 */
  function localDesc(type, key, fallback) {
    const lang = I18N.getLang();
    if (lang === 'ja') return fallback;
    if (type === 'place') {
      const pe = DATA.places && DATA.places[key] && DATA.places[key][lang];
      if (pe && pe.desc) return pe.desc;
      if (pe && pe.modern) return pe.modern;
      return fallback;
    }
    const tableKey = { person: 'persons', office: 'offices', special: 'specials' }[type];
    const e = tableKey && DATA[tableKey] && DATA[tableKey][key];
    return e && e[lang] && e[lang].desc ? e[lang].desc : fallback;
  }

  /** 静的HTML（data-i18n / data-i18n-title / data-i18n-placeholder・巻選択の選択肢）を選択言語へ書き換える。 */
  function applyStaticUi() {
    const lang = I18N.getLang();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('.vol-nav-bar select option').forEach(opt => {
      if (opt.value === 'glossary.html') {
        opt.textContent = t('glossaryOption');
      } else if (VOL_OPTION_LABELS[opt.value]) {
        opt.textContent = VOL_OPTION_LABELS[opt.value][lang] || VOL_OPTION_LABELS[opt.value].ja;
      }
    });
  }

  const HOMONYM_LABELS = {
    '劉岱': {
      ja: '劉岱（東萊・兗州刺史）',
      zh_tw: '劉岱（東萊・兗州刺史）',
      zh_cn: '刘岱（东莱・兖州刺史）',
      ko: '유대（동래·연주자사）'
    },
    '劉岱_沛国': {
      ja: '劉岱（沛国・司空長史）',
      zh_tw: '劉岱（沛國・司空長史）',
      zh_cn: '刘岱（沛国・司空长史）',
      ko: '유대（패국·시공장사）'
    },
    '張超_東平': {
      ja: '張超（東平・広陵太守）',
      zh_tw: '張超（東平・廣陵太守）',
      zh_cn: '张超（东平・广陵太守）',
      ko: '장초（동평·광릉태수）'
    },
    '張超_河間': {
      ja: '張超（河間・文人）',
      zh_tw: '張超（河間・文人）',
      zh_cn: '张超（河间・文人）',
      ko: '장초（하간·문인）'
    },
    '王朗': {
      ja: '王朗（東海・会稽太守／司徒）',
      zh_tw: '王朗（東海・會稽太守／司徒）',
      zh_cn: '王朗（东海・会稽太守／司徒）',
      ko: '왕랑（동해·회계태수／사도）'
    },
    '王朗_将軍': {
      ja: '王朗（曹操軍の将軍）',
      zh_tw: '王朗（曹操軍將領）',
      zh_cn: '王朗（曹操军将领）',
      ko: '왕랑（조조군의 장군）'
    },
    '張南': {
      ja: '張南（袁煕部将・焦触とともに降伏）',
      zh_tw: '張南（袁熙部將・同焦觸降曹）',
      zh_cn: '张南（袁熙部将・同焦触降曹）',
      ko: '장남（원희 부장·초촉과 함께 항복）'
    },
    '張承': {
      ja: '張承（河内・張範の弟／諫議大夫）',
      zh_tw: '張承（河內・張範之弟／諫議大夫）',
      zh_cn: '张承（河内・张范之弟／谏议大夫）',
      ko: '장승（하내·장범의 아우／간의대부）'
    },
    '張承_呉': {
      ja: '張承（呉・張昭の長男／濡須督）',
      zh_tw: '張承（東吳・張昭長子／濡須督）',
      zh_cn: '张承（东吴・张昭长子／濡须督）',
      ko: '장승（동오·장소의 장남／유수독）'
    },
    '張汎': {
      ja: '張汎（張遼の兄）',
      zh_tw: '張汎（張遼之兄）',
      zh_cn: '张汎（张辽之兄）',
      ko: '장범（장료의 형）'
    },
    '張統': {
      ja: '張統（張遼の孫・晋陽侯）',
      zh_tw: '張統（張遼之孫・晉陽侯）',
      zh_cn: '张统（张辽之孙・晋阳侯）',
      ko: '장통（장료의 손자·진양후）'
    },
    '斉桓公': {
      ja: '斉桓公（春秋斉の覇者・小白）',
      zh_tw: '齊桓公（春秋齊國霸主・小白）',
      zh_cn: '齐桓公（齐国霸主・小白）',
      ko: '제환공（춘추 제나라 패자·소백）'
    },
    '曹節': {
      ja: '曹節（曹騰の父・字は元偉）',
      zh_tw: '曹節（曹騰之父・字元偉）',
      zh_cn: '曹节（曹腾之父・字元伟）',
      ko: '조절（조등의 아버지·자 원위）'
    },
    '曹豹': {
      ja: '曹豹（陶謙・劉備部将）',
      zh_tw: '曹豹（陶謙・劉備部將）',
      zh_cn: '曹豹（陶谦・刘备部将）',
      ko: '조표（도겸·유비 부장）'
    },
    '曹豹_曹操子': {
      ja: '曹豹（曹操の子・饒陽侯）',
      zh_tw: '曹豹（曹操之子・饒陽侯）',
      zh_cn: '曹豹（曹操之子・饶阳侯）',
      ko: '조표（조조의 아들·요양후）'
    },
    '李豊': {
      ja: '李豊（袁術部将）',
      zh_tw: '李豐（袁術部將）',
      zh_cn: '李丰（袁术部将）',
      ko: '이풍（원술 부장）'
    },
    '李進': {
      ja: '李進（済陰乗氏の豪族）',
      zh_tw: '李進（濟陰乘氏豪族）',
      zh_cn: '李进（济阴乘氏豪族）',
      ko: '이진（제음 승씨의 호족）'
    },
    '献穆曹皇后': {
      ja: '献穆曹皇后（曹操の女・諱は節）',
      zh_tw: '獻穆曹皇后（曹操之女・諱節）',
      zh_cn: '献穆曹皇后（曹操之女・讳节）',
      ko: '헌목조황후（조조의 딸·휘는 절）'
    },
    '王商': {
      ja: '王商（前漢の丞相・楽昌侯）',
      zh_tw: '王商（西漢丞相・樂昌侯）',
      zh_cn: '王商（西汉丞相・乐昌侯）',
      ko: '왕상（전한의 승상·악창후）'
    },
    '郄倹': {
      ja: '郄倹（字は孟節・左慈と並ぶ方士）',
      zh_tw: '郄儉（字孟節・與左慈並稱方士）',
      zh_cn: '郄俭（字孟节・与左慈并称方士）',
      ko: '극검（자 맹절·좌자와 함께 알려진 방사）'
    },
    '郤倹': {
      ja: '郤倹（益州刺史・郤正の祖父）',
      zh_tw: '郤儉（益州刺史・郤正之祖父）',
      zh_cn: '郤俭（益州刺史・郤正之祖父）',
      ko: '극검（익주자사·극정의 할아버지）'
    },
    '陳紀': {
      ja: '陳紀（丹陽・袁術配下の九江太守）',
      zh_tw: '陳紀（丹陽・袁術部下九江太守）',
      zh_cn: '陈纪（丹阳・袁术部下九江太守）',
      ko: '진기（단양·원술 수하 구강태수）'
    },
    '魯桓公': {
      ja: '魯桓公（春秋魯の君主・姫軌）',
      zh_tw: '魯桓公（春秋魯國君主・姬軌）',
      zh_cn: '鲁桓公（春秋鲁国君主・姬轨）',
      ko: '노환공（춘추 노나라 군주·희궤）'
    }
  };

  /** 同名異人の識別名・表示名（チップや詳細見出し用）。未翻訳は localName または defaultLabel。 */
  function dispName(type, key, defaultLabel) {
    const lang = I18N.getLang();
    if (HOMONYM_LABELS[key]) {
      const entry = HOMONYM_LABELS[key];
      return entry[lang] || entry.ja;
    }
    return I18N.localName(type, key, defaultLabel);
  }

  /** 年代表記（例：建和元年（147年））。未翻訳は日本語のまま。 */
  function eraYear(jaEra) {
    return pick(DATA.eras, jaEra) || jaEra;
  }

  Object.assign(I18N, {
    t: t,
    eraYear: eraYear,
    dispName: dispName,
    typeLabel: typeLabel,
    volLabel: volLabel,
    sectionTitle: sectionTitle,
    categoryLabel: categoryLabel,
    localDesc: localDesc,
    applyStaticUi: applyStaticUi
  });

  I18N.onChange(applyStaticUi);
  if (global.addEventListener) global.addEventListener('load', applyStaticUi);
})(typeof window !== 'undefined' ? window : globalThis);
