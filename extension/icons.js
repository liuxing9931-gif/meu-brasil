/* Fala-style local line icons. No fonts, images or remote resources. */
window.FalaPanelIcons={icon(name,size=18){
 const paths={
  sound:'M3 9h4l5-5v16l-5-5H3zM16 8q5 4 0 8m3-11q8 7 0 14',
  mute:'M3 9h4l5-5v16l-5-5H3zM16 9l6 6m0-6-6 6',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  sync:'M20 4v6h-6M4 20v-6h6M5 9a7 7 0 0 1 12-4l3 5M4 14l3 5a7 7 0 0 0 12-4',
  book:'M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16',
  open:'M14 4h6v6m0-6-9 9M10 4H4v16h16v-6',
  arrow:'M4 12h16m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',
  again:'M4 4v6h6M5 10a7 7 0 1 1 0 5',
  hard:'m4 16 5-6 4 3 7-9M15 4h5v5',
  good:'m5 12 4 4L19 6',
  easy:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9z'
 };
 return `<svg class="line-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
}};
