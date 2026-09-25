export const THEME_KEY = 'backup-dashboard-theme';

/** Inline script for <head>: apply the saved theme before first paint. */
export const themeInitScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
