export const THEME_KEY = "ml:theme";

/** 화면이 그려지기 전에 저장된 테마를 적용하는 스크립트 (깜빡임 방지) */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"||t==="green")document.documentElement.dataset.theme=t}catch(e){}`;
