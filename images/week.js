/* =====================================================================
   week.js  —  今週の限定商品
   ★ 毎週ここだけ書き換えれば「今週の限定」が更新されます ★

   ・nameJp / nameEn ... 商品名（日本語 / 英語）
   ・priceLabel ....... 価格の表示（例: "RM7 / 個"）
   ・descJp / descEn .. 説明文（日本語 / 英語）
   ・image ............ 写真ファイル名。assets/images/ に入れた写真の名前。
                        写真がまだ無い時は "" （空）にしておくと
                        「準備中」のプレースホルダーが出ます。
   ===================================================================== */
window.WEEKLY_SPECIAL = {
  nameJp: "北海道黒豆大福",
  nameEn: "Hokkaido Black Soybean Daifuku",
  priceLabel: "RM7 / 個",
  priceEn: "RM7 / piece",
  // まとめ注文の計算に使う1個あたりの価格（数字だけ）
  unitPrice: 7,
  descJp: "北海道産の黒豆を、蜜でふっくらと炊き上げました。やさしい手作りのあんことほっくりとした豆の食感は上品な味わいです。北海道の恵みをひとつひとつ丁寧に包みました。",
  descEn: "Plump Hokkaido black soybeans, gently simmered in syrup. Soft handmade red bean paste meets the mellow texture of the beans for a refined taste — each one wrapped with care, a gift from Hokkaido.",
  // 写真ファイル名（assets/images/ の中）。無ければ "" のままでOK
  image: "daifuku.jpg",
};
