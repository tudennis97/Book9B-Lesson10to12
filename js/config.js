/* ============================================================
   遊戲館共用設定 ── 只要改這一個檔案，三個遊戲都會套用
   ============================================================ */
window.GAME_CONFIG = {
  /* Apps Script「網頁應用程式」網址（以 /exec 結尾）。留空＝不上傳，成績只顯示在畫面上。 */
  ENDPOINT: "https://script.google.com/macros/s/AKfycby2LuV2-WPev9A91pM-yG7WAGIu90qgU63ZFLbR6i6qNMF3UZ9fTt6Y8-rYQEPxdOrr/exec",

  /* 通行碼：必須和 Code.gs 裡 var TOKEN 完全相同；兩邊都留空＝不檢查。 */
  TOKEN: "",

  /* 玩家資料預設值（學生可自行修改，修改後會記在該台裝置上） */
  DEFAULT_SCHOOL: "布理斯本亞洲語文學校",
  DEFAULT_CLASS: "11B",

  /* 是否記錄 IP 位址（瀏覽器向 api.ipify.org 查詢公開 IP）。改成 false 就不記錄。 ㄊㄞˊㄉㄨˊ8964ㄒ一ˊㄐ一ㄣˋㄆ一ㄥˊ*/
  COLLECT_IP: true
};
