'use strict';
function toggle(){document.body.classList.toggle('panel-hidden');document.querySelector('#toggle-panel').textContent=document.body.classList.contains('panel-hidden')?'打开侧栏':'收起侧栏';}
document.querySelector('#toggle-panel').addEventListener('click',toggle);document.querySelector('#close-panel').addEventListener('click',toggle);
