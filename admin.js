/* ===== Admin backend ===== */
(function(){
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let D = null;
  let undoStack = [];
  let drag = null;
  let editingId = null;
  let boardDiv = '';   // '' | 'G' | 'B'

  /* ---------------- gate ---------------- */
  $('#gateBtn').addEventListener('click', tryUnlock);
  $('#gatePass').addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });

  function tryUnlock(){
    const v = $('#gatePass').value;
    if(v === SD.getPass()){
      $('#gate').classList.remove('open');
      $('#app').style.display = '';
      boot();
    } else {
      $('#gateErr').style.display = 'block';
      $('#gatePass').value = '';
    }
  }

  /* ---------------- boot ---------------- */
  function boot(){
    D = SD.getDraft();
    if(!D.times) D.times = [];
    if(!D.fields) D.fields = [];
    if(!D.blocked) D.blocked = [];
    if(!D.teams) D.teams = {G:[],B:[]};
    renderAll();
  }

  function save(){ SD.saveDraft(D); }
  function pushUndo(){
    undoStack.push(JSON.stringify(D));
    if(undoStack.length > 60) undoStack.shift();
  }

  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(()=>t.classList.remove('show'), 1900);
  }

  /* ---------------- tabs ---------------- */
  $$('.tabs button').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('.tabs button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      $$('.tabpane').forEach(p=>p.classList.remove('on'));
      $('#pane-' + b.dataset.tab).classList.add('on');
      if(b.dataset.tab==='teams') fillTeamsTab();
      if(b.dataset.tab==='settings') fillSettingsTab();
      if(b.dataset.tab==='print') fillPrintTab();
      if(b.dataset.tab==='officials') renderOfficials();
    });
  });

  $$('#boardDiv button').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('#boardDiv button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      boardDiv = b.dataset.d || '';
      renderBoard();
    });
  });

  /* ---------------- board ---------------- */
  function renderBoard(){
    const fields = D.fields;
    let html = '<thead><tr><th class="tcol">Time</th>';
    fields.forEach(f=> html += `<th>${esc(f.name)}${f.sub?'<span style="display:block;font-size:10px;font-weight:500;opacity:.7">'+esc(f.sub)+'</span>':''}</th>`);
    html += '</tr></thead><tbody>';

    D.times.forEach(time=>{
      html += `<tr><td class="tcell">${esc(time)}</td>`;
      fields.forEach(f=>{
        if(SD.isBlocked(D, f.id, time)){
          html += `<td><div class="dropzone blocked">BLOCKED</div></td>`;
          return;
        }
        const games = SD.gamesAt(D, f.id, time).filter(g=>!boardDiv || g.gender===boardDiv);
        const inner = games.length
          ? games.map(g=>chip(g)).join('')
          : '';
        html += `<td><div class="dropzone" data-field="${esc(f.id)}" data-time="${esc(time)}">${inner}</div></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    $('#board').innerHTML = html;
    wireBoard();
  }

  function chip(g){
    const cls = g.gender==='G' ? 'girls' : 'boys';
    const num = g.num ? '#'+esc(g.num) : '-';
    return `<div class="chip ${cls}" draggable="true" data-id="${esc(g.id)}">
      <div class="c-top">
        <span class="c-num ${g.num?'':'none'}">${num}</span>
        <span class="c-g">${g.gender==='G'?'GIRLS':'BOYS'}</span>
      </div>
      <div class="c-teams">
        <span class="tslot" data-slot="a" data-id="${esc(g.id)}">${esc(g.a||'TBD')}</span>
        <span class="vs">vs</span>
        <span class="tslot" data-slot="b" data-id="${esc(g.id)}">${esc(g.b||'TBD')}</span>
      </div>
    </div>`;
  }

  function wireBoard(){
    // chips: drag + click
    $$('#board .chip').forEach(el=>{
      el.addEventListener('dragstart', e=>{
        drag = {type:'game', id: el.dataset.id};
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', el.dataset.id);
      });
      el.addEventListener('dragend', ()=>{ el.classList.remove('dragging'); drag=null; });
      el.addEventListener('click', e=>{
        if(e.target.classList.contains('tslot')) return;
        openEditor(el.dataset.id);
      });
    });

    // team slots
    $$('#board .tslot').forEach(el=>{
      el.addEventListener('dragover', e=>{
        if(drag && drag.type==='team'){ e.preventDefault(); el.classList.add('over'); }
      });
      el.addEventListener('dragleave', ()=> el.classList.remove('over'));
      el.addEventListener('drop', e=>{
        e.preventDefault(); e.stopPropagation();
        el.classList.remove('over');
        if(!drag || drag.type!=='team') return;
        const g = D.games.find(x=>x.id===el.dataset.id);
        if(!g) return;
        pushUndo();
        g[el.dataset.slot] = drag.name;
        g.gender = drag.gender;
        save(); renderBoard(); renderTray(); toast('Matchup updated');
      });
      // click a team slot to pick from a dropdown
      el.addEventListener('click', e=>{
        e.stopPropagation();
        openEditor(el.dataset.id);
      });
    });

    // drop zones
    $$('#board .dropzone').forEach(el=>{
      el.addEventListener('dragover', e=>{
        if(drag && drag.type==='game'){ e.preventDefault(); el.classList.add('over'); }
      });
      el.addEventListener('dragleave', ()=> el.classList.remove('over'));
      el.addEventListener('drop', e=>{
        e.preventDefault();
        el.classList.remove('over');
        if(!drag || drag.type!=='game') return;
        moveGame(drag.id, el.dataset.field, el.dataset.time);
      });
    });
  }

  function moveGame(id, field, time){
    const g = D.games.find(x=>x.id===id);
    if(!g) return;
    if(g.field===field && g.time===time) return;
    const occupant = D.games.find(x=>x.id!==id && x.field===field && x.time===time);
    pushUndo();
    if(occupant){
      occupant.field = g.field;
      occupant.time = g.time;
    }
    g.field = field;
    g.time = time;
    save(); renderBoard(); renderTray();
    toast(occupant ? 'Matches swapped' : 'Match moved');
  }

  /* ---------------- tray ---------------- */
  function renderTray(){
    const loose = D.games.filter(g=>!g.field || !g.time);
    const t = $('#tray');
    if(!loose.length){
      t.innerHTML = '<div class="tray-empty">All matches are placed on the board. 🎉</div>';
    } else {
      t.innerHTML = loose.map(g=>chip(g)).join('');
    }
    t.querySelectorAll('.chip').forEach(el=>{
      el.addEventListener('dragstart', e=>{
        drag = {type:'game', id: el.dataset.id};
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', el.dataset.id);
      });
      el.addEventListener('dragend', ()=>{ el.classList.remove('dragging'); drag=null; });
      el.addEventListener('click', ()=> openEditor(el.dataset.id));
    });
    t.querySelectorAll('.tslot').forEach(el=>{
      el.addEventListener('dragover', e=>{ if(drag&&drag.type==='team'){e.preventDefault();el.classList.add('over');} });
      el.addEventListener('dragleave', ()=> el.classList.remove('over'));
      el.addEventListener('drop', e=>{
        e.preventDefault(); e.stopPropagation(); el.classList.remove('over');
        if(!drag||drag.type!=='team') return;
        const g = D.games.find(x=>x.id===el.dataset.id);
        if(!g) return;
        pushUndo(); g[el.dataset.slot]=drag.name; g.gender=drag.gender;
        save(); renderBoard(); renderTray();
      });
      el.addEventListener('click', e=>{ e.stopPropagation(); openEditor(el.dataset.id); });
    });
    // allow dropping a game onto the tray to unschedule
    t.addEventListener('dragover', e=>{ if(drag&&drag.type==='game'){e.preventDefault();t.classList.add('over');} });
    t.addEventListener('dragleave', ()=> t.classList.remove('over'));
    t.addEventListener('drop', e=>{
      e.preventDefault(); t.classList.remove('over');
      if(!drag||drag.type!=='game') return;
      const g = D.games.find(x=>x.id===drag.id);
      if(!g) return;
      pushUndo(); g.field=null; g.time=null;
      save(); renderBoard(); renderTray(); toast('Match unscheduled');
    });
  }

  /* ---------------- team pool ---------------- */
  function renderPool(){
    const pool = $('#teamPool');
    const g = (D.teams.G||[]), b = (D.teams.B||[]);
    let html = '';
    html += '<div class="pool-head">Girls teams</div><div class="teampool">' +
      g.map(t=>`<div class="teamchip g" draggable="true" data-name="${esc(t)}" data-gender="G">${esc(t)}</div>`).join('') + '</div>';
    html += '<div class="pool-head">Boys teams</div><div class="teampool">' +
      b.map(t=>`<div class="teamchip b" draggable="true" data-name="${esc(t)}" data-gender="B">${esc(t)}</div>`).join('') + '</div>';
    pool.innerHTML = html;
    pool.querySelectorAll('.teamchip').forEach(el=>{
      el.addEventListener('dragstart', e=>{
        drag = {type:'team', name: el.dataset.name, gender: el.dataset.gender};
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', el.dataset.name);
      });
      el.addEventListener('dragend', ()=>{ el.classList.remove('dragging'); drag=null; });
    });
  }

  /* ---------------- editor drawer ---------------- */
  function openEditor(id){
    const g = D.games.find(x=>x.id===id);
    if(!g) return;
    editingId = id;
    const all = allTeamNames();
    fillSelect($('#edA'), all, g.a);
    fillSelect($('#edB'), all, g.b);
    fillSelect($('#edField'), D.fields.map(f=>({v:f.id,t:f.name + (f.sub?', '+f.sub:'')})), g.field);
    fillSelect($('#edTime'), D.times.map(t=>({v:t,t:t})), g.time);
    $('#edNum').value = g.num || '';
    $('#edGno').value = g.gno || '';
    $('#edO1').value = g.o1 || '';
    $('#edO2').value = g.o2 || '';
    $('#edGender').value = g.gender || 'B';
    fillEditorTeams(g.gender || 'B');
    $('#edNote').value = g.note || '';
    $('#drawer').classList.add('open');
  }
  function fillEditorTeams(gender){
    const list = SD.teamsIn(D, gender);
    fillSelect($('#edA'), list, $('#edA').value);
    fillSelect($('#edB'), list, $('#edB').value);
  }
  $('#edGender').addEventListener('change', e=>{
    const g = D.games.find(x=>x.id===editingId);
    if(!g) return;
    const list = SD.teamsIn(D, e.target.value);
    fillSelect($('#edA'), list, list.indexOf(g.a) > -1 ? g.a : '');
    fillSelect($('#edB'), list, list.indexOf(g.b) > -1 ? g.b : '');
  });

  function fillSelect(sel, items, val){
    sel.innerHTML = '<option value="">-</option>';
    items.forEach(it=>{
      const v = typeof it === 'string' ? it : it.v;
      const t = typeof it === 'string' ? it : it.t;
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if(v === val) o.selected = true;
      sel.appendChild(o);
    });
  }
  function allTeamNames(){
    const s = new Set([...(D.teams.G||[]), ...(D.teams.B||[])]);
    D.games.forEach(g=>{ if(g.a) s.add(g.a); if(g.b) s.add(g.b); });
    return Array.from(s).sort((a,b)=>a.localeCompare(b));
  }

  $('#drawerClose').addEventListener('click', closeEditor);
  $('#edCancel').addEventListener('click', closeEditor);
  function closeEditor(){ $('#drawer').classList.remove('open'); editingId=null; }

  $('#edSave').addEventListener('click', ()=>{
    const g = D.games.find(x=>x.id===editingId);
    if(!g) return;
    pushUndo();
    g.num = $('#edNum').value ? parseInt($('#edNum').value,10) : null;
    g.gno = ($('#edGno').value || '').trim();
    g.o1  = ($('#edO1').value || '').trim();
    g.o2  = ($('#edO2').value || '').trim();
    g.gender = $('#edGender').value;
    g.a = $('#edA').value || '';
    g.b = $('#edB').value || '';
    g.field = $('#edField').value || null;
    g.time = $('#edTime').value || null;
    g.note = $('#edNote').value || '';
    save(); renderBoard(); renderTray(); closeEditor(); toast('Match saved');
  });

  $('#edDelete').addEventListener('click', ()=>{
    if(!editingId) return;
    pushUndo();
    D.games = D.games.filter(x=>x.id!==editingId);
    save(); renderBoard(); renderTray(); closeEditor(); toast('Match deleted');
  });

  /* ---------------- add / auto-number / undo ---------------- */
  $('#btnAddGame').addEventListener('click', ()=>{
    pushUndo();
    const id = SD.newId(D);
    D.games.push({id, num:null, field:null, time:null, gender:'B', a:'', b:'', note:''});
    save(); renderBoard(); renderTray();
    openEditor(id);
  });

  $('#btnAutoNum').addEventListener('click', ()=>{
    pushUndo();
    const ordered = SD.sortGames(D, D.games.slice());
    ordered.forEach((g,i)=>{ g.num = i+1; });
    save(); renderBoard(); renderTray(); toast('Numbered 1 to ' + ordered.length);
  });

  $('#btnUndo').addEventListener('click', ()=>{
    if(!undoStack.length){ toast('Nothing to undo'); return; }
    D = JSON.parse(undoStack.pop());
    save(); renderAll(); toast('Undone');
  });

  /* ---------------- teams tab ---------------- */
  function fillTeamsTab(){
    $('#taGirls').value = (D.teams.G||[]).join('\n');
    $('#taBoys').value  = (D.teams.B||[]).join('\n');
    const gc = (D.teams.G||[]).length, bc = (D.teams.B||[]).length;
    if($('#girlsCount')) $('#girlsCount').textContent = gc + (gc===1?' team':' teams');
    if($('#boysCount'))  $('#boysCount').textContent  = bc + (bc===1?' team':' teams');
  }
  $('#btnSaveTeams').addEventListener('click', ()=>{
    pushUndo();
    D.teams.G = $('#taGirls').value.split('\n').map(s=>s.trim()).filter(Boolean);
    D.teams.B = $('#taBoys').value.split('\n').map(s=>s.trim()).filter(Boolean);
    save(); renderPool(); fillPrintTab(); toast('Rosters saved');
  });

  /* ---------------- print tab ---------------- */
  function fillPrintTab(){
    const sel = $('#prTeam');
    sel.innerHTML = '<option value="">Choose a team\u2026</option>';
    const add = (label, list, gender)=>{
      if(!list.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      list.forEach(t=>{
        const o=document.createElement('option');
        o.value = SD.teamKey(gender, t);
        o.textContent = t;
        og.appendChild(o);
      });
      sel.appendChild(og);
    };
    add('Girls teams', SD.teamsIn(D,'G'), 'G');
    add('Boys teams',  SD.teamsIn(D,'B'), 'B');
  }
  $$('[data-print]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = b.dataset.print;
      if(v==='all'){
        printGames('Full Match Schedule','All fields', SD.sortGames(D, D.games.filter(g=>g.field&&g.time)), true);
      } else if(v==='G' || v==='B'){
        const label = v==='G' ? 'Girls' : 'Boys';
        printGames(label + ' Division Match Schedule', 'All ' + label.toLowerCase() + ' matches, all fields',
          SD.sortGames(D, D.games.filter(g=>g.field&&g.time&&g.gender===v)), true);
      } else {
        const f = D.fields.find(x=>x.id===v);
        printGames((f?f.name:'Field') + ' Schedule', (f&&f.sub)||'', SD.sortGames(D, D.games.filter(g=>g.field===v)), true);
      }
    });
  });
  $('#btnPrintTeam').addEventListener('click', ()=>{
    const k = SD.parseTeamKey($('#prTeam').value);
    if(!k.name){ toast('Choose a team first'); return; }
    printGames(k.name + ' Schedule',
      (k.gender==='G'?'Girls':'Boys') + ' division \u00b7 three matches and field locations',
      SD.teamGames(D, k.name, k.gender), true);
  });
  $('#btnPrintPay').addEventListener('click', ()=>{
    paySheet(parseFloat($('#prRate').value)||0);
  });


  function printGridAdmin(title, subtitle, games, fieldFilter){
    const fields = D.fields.filter(f=>!fieldFilter || f.id===fieldFilter);
    const set = new Set(games.map(g=>g.id));
    let head = '<tr><th class="pg-time">Time</th>';
    fields.forEach(f=>{
      head += '<th>' + esc(f.name) + (f.sub ? '<span class="pg-sub">' + esc(f.sub) + '</span>' : '') + '</th>';
    });
    head += '</tr>';
    let body = '';
    D.times.forEach(time=>{
      let any = false, cells = '';
      fields.forEach(f=>{
        const gs = SD.gamesAt(D, f.id, time).filter(g=>set.has(g.id));
        if(gs.length){
          any = true;
          cells += '<td class="pg-cell">' + gs.map(g=>
            '<div class="pg-game ' + (g.gender==='G'?'g':'b') + '">'
            + '<div class="pg-badge">' + (g.gender==='G'?'GIRLS':'BOYS') + '</div>'
            + '<div class="pg-teams">' + esc(g.a) + ' <span>vs</span> ' + esc(g.b) + '</div>'
            + '</div>').join('') + '</td>';
        } else {
          cells += '<td class="pg-cell pg-empty"></td>';
        }
      });
      if(any) body += '<tr><td class="pg-time">' + esc(time) + '</td>' + cells + '</tr>';
    });
    $('#print-area').innerHTML = ''
      + '<div class="print-head"><img src="crest.png" alt=""><div>'
      + '<div class="ph-t">' + esc(title) + '</div>'
      + '<div class="ph-s">' + esc(subtitle) + '</div></div></div>'
      + '<table class="p-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>'
      + '<div class="p-foot">' + esc(D.event.title) + ' \u00b7 ' + esc(D.event.date||'') + ' \u00b7 '
      + esc(D.event.venue||'') + ' \u00b7 ' + games.length + ' matches</div>';
    window.print();
  }

  $$('[data-pgrid]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = b.dataset.pgrid;
      if(v==='all'){
        printGridAdmin('Match Day Schedule', 'All matches, all fields',
          SD.sortGames(D, D.games.filter(g=>g.field&&g.time)), null);
      } else if(v==='G' || v==='B'){
        const label = v==='G' ? 'Girls' : 'Boys';
        printGridAdmin(label + ' Division Match Day Schedule', 'All ' + label.toLowerCase() + ' matches, all fields',
          SD.sortGames(D, D.games.filter(g=>g.field&&g.time&&g.gender===v)), null);
      } else {
        const f = D.fields.find(x=>x.id===v);
        printGridAdmin((f?f.name:'Field') + ' Schedule', (f&&f.sub)||'',
          SD.sortGames(D, D.games.filter(g=>g.field===v)), v);
      }
    });
  });

  function printGames(title, subtitle, games, showNum){
    const rows = games.map(g=>`<tr>
        <td class="p-num">${showNum && g.num ? '#'+esc(g.num) : ''}</td>
        <td>${esc(g.time||'TBD')}</td>
        <td>${esc(g.field?SD.fieldLabel(D,g.field):'TBD')}</td>
        <td class="p-g">${g.gender==='G'?'Girls':'Boys'}</td>
        <td>${esc(g.a||'TBD')} vs ${esc(g.b||'TBD')}</td>
      </tr>`).join('');
    $('#print-area').innerHTML = `
      <div class="print-head"><img src="crest.png" alt=""><div><div class="ph-t">${esc(title)}</div><div class="ph-s">${esc(subtitle)}</div></div></div>
      <table class="p-table">
        <thead><tr><th>Game</th><th>Time</th><th>Field</th><th>Division</th><th>Matchup</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="p-foot">${esc(D.event.title)} · ${esc(D.event.venue||'')} · ${games.length} matches</div>`;
    window.print();
  }

  /* ---------------- settings ---------------- */
  function fillSettingsTab(){
    $('#stTitle').value = D.event.title||'';
    $('#stSub').value   = D.event.subtitle||'';
    $('#stDate').value  = D.event.date||'';
    $('#stVenue').value = D.event.venue||'';
    $('#taTimes').value = (D.times||[]).join('\n');
    renderFieldList();
  }
  function renderFieldList(){
    $('#fieldList').innerHTML = D.fields.map((f,i)=>`
      <div style="display:flex;gap:9px;margin-bottom:9px;align-items:center;flex-wrap:wrap">
        <input type="text" value="${esc(f.name)}" data-fid="${f.id}" data-k="name" style="max-width:170px">
        <input type="text" value="${esc(f.sub||'')}" data-fid="${f.id}" data-k="sub" placeholder="Sub-label" style="max-width:230px">
        <button class="btn sm danger" data-delfield="${f.id}">Remove</button>
      </div>`).join('');
    $$('#fieldList input').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const f = D.fields.find(x=>x.id===inp.dataset.fid);
        if(f){ f[inp.dataset.k] = inp.value; save(); renderBoard(); }
      });
    });
    $$('#fieldList [data-delfield]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const id = b.dataset.delfield;
        if(D.games.some(g=>g.field===id)){ toast('Move those matches first'); return; }
        pushUndo();
        D.fields = D.fields.filter(f=>f.id!==id);
        D.blocked = D.blocked.filter(b=>b[0]!==id);
        save(); renderFieldList(); renderBoard();
      });
    });
  }
  ['stTitle','stSub','stDate','stVenue'].forEach(id=>{
    $('#'+id).addEventListener('change', ()=>{
      D.event.title = $('#stTitle').value;
      D.event.subtitle = $('#stSub').value;
      D.event.date = $('#stDate').value;
      D.event.venue = $('#stVenue').value;
      save();
    });
  });
  $('#btnAddField').addEventListener('click', ()=>{
    pushUndo();
    let n = D.fields.length+1;
    const id = 'f'+n;
    D.fields.push({id, name:'Field '+n, sub:''});
    save(); renderFieldList(); renderBoard();
  });
  $('#btnSaveTimes').addEventListener('click', ()=>{
    pushUndo();
    D.times = $('#taTimes').value.split('\n').map(s=>s.trim()).filter(Boolean);
    save(); renderBoard(); toast('Time slots saved');
  });
  $('#btnSavePass').addEventListener('click', ()=>{
    const p = $('#stPass').value.trim();
    if(p.length < 4){ toast('Use at least 4 characters'); return; }
    SD.setPass(p); $('#stPass').value=''; toast('Password updated');
  });

  /* ---------------- publish ---------------- */
  function makeLink(div){
    const enc = SD.encode(D);
    const base = location.href.replace(/admin\.html.*$/,'index.html');
    const url = base + (div ? '?d=' + div : '') + '#s=' + enc;
    $('#linkBox').style.display = '';
    $('#shareLink').value = url;
    $('#btnOpenLink').href = url;
    $('#linkLen').textContent = url.length + ' characters. Works in email, text, or a QR code.'
      + (div ? ' Opens already filtered to ' + (div==='G'?'girls':'boys') + '.' : '');
    SD.publish(D);
    toast(div ? (div==='G'?'Girls':'Boys') + ' link ready' : 'Link ready');
  }
  $('#btnGenLink').addEventListener('click', ()=> makeLink(''));
  $('#btnGenLinkG').addEventListener('click', ()=> makeLink('G'));
  $('#btnGenLinkB').addEventListener('click', ()=> makeLink('B'));
  $('#btnCopy').addEventListener('click', async ()=>{
    const el = $('#shareLink');
    el.select();
    try{ await navigator.clipboard.writeText(el.value); toast('Copied'); }
    catch(e){ document.execCommand('copy'); toast('Copied'); }
  });
  /* ---------- publish to live site ---------- */
  function publishFile(){
    const body = JSON.stringify(D, null, 2);
    const header =
      '/* ============================================================\n' +
      '   2027 El Reno Spring Classic - LIVE PUBLISHED SCHEDULE\n' +
      '   Published: ' + new Date().toLocaleString() + '\n' +
      '   ------------------------------------------------------------\n' +
      '   This file is what the public site actually shows.\n' +
      '   Replace the existing published-data.js with this file.\n' +
      '   ============================================================ */\n';
    const text = header + 'window.PUBLISHED_DATA = ' + body + ';\n';
    const blob = new Blob([text], {type:'application/javascript'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'published-data.js';
    a.click();
    URL.revokeObjectURL(a.href);

    SD.publish(D);
    const n = D.games.length;
    $('#pubStat').textContent = 'Ready. ' + n + ' matches packed into the file. '
      + 'Attach published-data.js in the chat and say "publish" to make it live for everyone.';
    toast('Publish file downloaded');
  }
  $('#btnPublishFile').addEventListener('click', publishFile);

  $('#btnExport').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(D,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'el-reno-soccer-schedule.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#btnImport').addEventListener('click', ()=> $('#fileImport').click());
  $('#fileImport').addEventListener('change', e=>{
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      try{
        const data = JSON.parse(r.result);
        if(!data.games) throw new Error('bad file');
        pushUndo(); D = data; save(); renderAll(); toast('Imported');
      }catch(err){ toast('Could not read that file'); }
    };
    r.readAsText(f);
  });
  $('#btnResetAll').addEventListener('click', ()=>{
    if(!confirm('Reset everything back to the original schedule?')) return;
    pushUndo();
    D = SD.clone(DEFAULT_DATA);
    save(); renderAll(); toast('Reset complete');
  });


  /* ---------------- officials tab ---------------- */
  function officialRows(){
    return SD.sortGames(D, D.games.filter(g=>g.field&&g.time));
  }

  function renderOfficials(){
    const tb = $('#offTable');
    if(!tb) return;
    const games = officialRows();
    let html = '<thead><tr>'
      + '<th class="c-num">Board #</th>'
      + '<th class="c-gno">Arbiter #</th>'
      + '<th class="c-time">Time</th>'
      + '<th class="c-field">Field</th>'
      + '<th class="c-div">Div</th>'
      + '<th>Matchup</th>'
      + '<th class="c-off">Official 1</th>'
      + '<th class="c-off">Official 2</th>'
      + '</tr></thead><tbody>';
    games.forEach(g=>{
      html += '<tr data-id="' + esc(g.id) + '">'
        + '<td class="c-num">' + (g.num ? esc(g.num) : '-') + '</td>'
        + '<td class="c-gno"><input class="cell-in mono" data-k="gno" value="' + esc(g.gno||'') + '" placeholder="00000"></td>'
        + '<td class="c-time">' + esc(g.time||'') + '</td>'
        + '<td class="c-field">' + esc(SD.fieldLabel(D, g.field)) + '</td>'
        + '<td class="c-div"><span class="div-tag ' + (g.gender==='G'?'g':'b') + '">' + (g.gender==='G'?'G':'B') + '</span></td>'
        + '<td>' + esc(g.a) + ' vs ' + esc(g.b) + '</td>'
        + '<td class="c-off"><input class="cell-in" data-k="o1" value="' + esc(g.o1||'') + '" placeholder="Name"></td>'
        + '<td class="c-off"><input class="cell-in" data-k="o2" value="' + esc(g.o2||'') + '" placeholder="Name"></td>'
        + '</tr>';
    });
    html += '</tbody>';
    tb.innerHTML = html;

    tb.querySelectorAll('input.cell-in').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const tr = inp.closest('tr');
        const g = D.games.find(x=>x.id===tr.dataset.id);
        if(!g) return;
        const k = inp.dataset.k;
        g[k] = inp.value.trim();
        save();
      });
      inp.addEventListener('blur', ()=>{ updateGnoStat(); });
    });

    updateGnoStat();
    renderOffPayList();
  }

  function updateGnoStat(){
    const el = $('#gnoStat');
    if(!el) return;
    const games = officialRows();
    const withNo = games.filter(g=>g.gno).length;
    const withOff = games.filter(g=>g.o1||g.o2).length;
    el.textContent = games.length + ' matches on the schedule. '
      + withNo + ' have an official game number. '
      + withOff + ' have at least one official named.';
  }

  function splitLine(line){
    if(line.indexOf('\t') > -1) return line.split('\t').map(x=>x.trim()).filter(x=>x!=='');
    return line.split(',').map(x=>x.trim()).filter(x=>x!=='');
  }

  $('#btnAssignGno').addEventListener('click', ()=>{
    const raw = ($('#taGno').value || '').split(/\r?\n/).map(l=>l.trim()).filter(l=>l!=='');
    if(!raw.length){ toast('Paste some game numbers first'); return; }
    const games = officialRows();
    if(!games.length){ toast('No scheduled matches to assign'); return; }
    pushUndo();
    let n = 0;
    raw.forEach((line, i)=>{
      if(i >= games.length) return;
      const parts = splitLine(line);
      if(!parts.length) return;
      const g = games[i];
      g.gno = parts[0];
      if(parts.length > 1) g.o1 = parts[1];
      if(parts.length > 2) g.o2 = parts[2];
      n++;
    });
    save();
    renderOfficials();
    toast('Assigned ' + n + ' game number' + (n===1?'':'s'));
    $('#gnoStat').textContent += ' Assigned ' + n + ' of ' + raw.length + ' pasted lines.';
  });

  $('#btnClearGno').addEventListener('click', ()=>{
    if(!confirm('Clear every game number and official name?')) return;
    pushUndo();
    D.games.forEach(g=>{ g.gno=''; g.o1=''; g.o2=''; });
    save();
    renderOfficials();
    toast('Cleared all game numbers');
  });

  function paySheet(rate){
    const games = officialRows();
    const rows = games.map(g=>'<tr>'
      + '<td class="p-num">' + (g.num ? esc(g.num) : '-') + '</td>'
      + '<td class="p-gno">' + esc(g.gno || '-') + '</td>'
      + '<td>' + esc(g.time||'') + '</td>'
      + '<td>' + esc(SD.fieldName(D, g.field)) + '</td>'
      + '<td>' + esc(g.a) + ' vs ' + esc(g.b) + '</td>'
      + '<td>' + esc(g.o1 || '') + '</td>'
      + '<td>' + esc(g.o2 || '') + '</td>'
      + '<td style="text-align:right">' + (rate ? '$' + rate.toFixed(2) : '') + '</td>'
      + '</tr>').join('');
    const total = rate ? rate * games.length : 0;
    const missing = games.filter(g=>!g.gno).length;
    $('#print-area').innerHTML = ''
      + '<div class="print-head"><img src="crest.png" alt=""><div>'
      + '<div class="ph-t">Officials Payment Sheet</div>'
      + '<div class="ph-s">' + esc(D.event.title) + ' \u00b7 ' + esc(D.event.date||'') + ' \u00b7 ' + games.length + ' matches'
      + (rate ? ' \u00b7 $' + rate.toFixed(2) + ' per game' : '') + '</div></div></div>'
      + '<table class="p-table"><thead><tr>'
      + '<th>Board #</th><th>Official Game #</th><th>Time</th><th>Field</th>'
      + '<th>Matchup</th><th>Official 1</th><th>Official 2</th><th style="text-align:right">Fee</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + (rate ? '<div style="margin-top:12pt;text-align:right;font-size:12pt;font-weight:700">Total: $' + total.toFixed(2) + '</div>' : '')
      + '<div class="p-foot">Official game numbers come from the assigning site. '
      + (missing ? missing + ' match' + (missing===1?'':'es') + ' still need a number.' : 'All matches have a number.')
      + '</div>';
    window.print();
  }

  $('#btnPrintPay2').addEventListener('click', ()=>{
    paySheet(parseFloat($('#prRate2').value)||0);
  });

  /* ---------------- individual official pay sheets ---------------- */

  // Group every scheduled match by official name. A name can appear in the
  // Official 1 or Official 2 column, and the same person can work many games.
  function officialIndex(){
    const games = officialRows();
    const map = new Map();
    games.forEach(g=>{
      [g.o1, g.o2].forEach(raw=>{
        const name = (raw||'').trim().replace(/\s+/g,' ');
        if(!name) return;
        const key = name.toLowerCase();
        if(!map.has(key)) map.set(key, {key:key, name:name, games:[]});
        const rec = map.get(key);
        if(rec.games.indexOf(g) === -1) rec.games.push(g);
      });
    });
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name));
  }

  function offPayRate(){
    const el = $('#prRate3');
    const v = el ? parseFloat(el.value) : 50;
    return isNaN(v) ? 0 : v;
  }

  function renderOffPayList(){
    const box = $('#offPayList');
    if(!box) return;
    const list = officialIndex();
    const rate = offPayRate();
    if(!list.length){
      box.innerHTML = '<p class="hint" style="margin:14px 0 0">No official names yet. Type names into the Official 1 and Official 2 columns above and they will appear here.</p>';
      return;
    }
    let html = '<table class="off-pay-table"><thead><tr>'
      + '<th>Official</th><th class="op-c">Matches</th><th>Arbiter numbers</th>'
      + '<th class="op-r">Total</th><th></th>'
      + '</tr></thead><tbody>';
    list.forEach(o=>{
      const nums = o.games.map(g=>g.gno).filter(Boolean);
      const money = rate ? '$' + (rate * o.games.length).toFixed(2) : '-';
      html += '<tr>'
        + '<td class="op-name">' + esc(o.name) + '</td>'
        + '<td class="op-c">' + o.games.length + '</td>'
        + '<td class="op-nums">' + (nums.length ? esc(nums.join(', ')) : '<span class="op-warn">no numbers yet</span>') + '</td>'
        + '<td class="op-r">' + money + '</td>'
        + '<td class="op-r"><button class="btn sm" data-print-off="' + esc(o.key) + '">Print sheet</button></td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    box.querySelectorAll('[data-print-off]').forEach(btn=>{
      btn.addEventListener('click', ()=> printOfficialSheets([btn.dataset.printOff], offPayRate()));
    });
  }

  // Build one printable page for a single official.
  function officialSheetHtml(o, rate, addBreak){
    const n = o.games.length;
    const total = rate * n;
    const rows = o.games.map(g=>'<tr>'
      + '<td class="p-gno">' + esc(g.gno || '-') + '</td>'
      + '<td>' + esc(g.time||'') + '</td>'
      + '<td>' + esc(SD.fieldName(D, g.field)) + '</td>'
      + '<td>' + (g.gender==='G' ? 'Girls' : 'Boys') + '</td>'
      + '<td>' + esc(g.a) + ' vs ' + esc(g.b) + '</td>'
      + '<td style="text-align:right">' + (rate ? '$' + rate.toFixed(2) : '') + '</td>'
      + '</tr>').join('');
    const missing = o.games.filter(g=>!g.gno).length;
    return '<div class="p-sheet' + (addBreak ? ' p-break' : '') + '">'
      + '<div class="print-head"><img src="crest.png" alt=""><div>'
      + '<div class="ph-t">Official Pay Sheet</div>'
      + '<div class="ph-s">' + esc(D.event.title) + ' \u00b7 ' + esc(D.event.date||'') + ' \u00b7 ' + esc(D.event.venue||'') + '</div>'
      + '</div></div>'
      + '<div class="p-off-name">' + esc(o.name) + '</div>'
      + '<table class="p-table"><thead><tr>'
      + '<th>Arbiter #</th><th>Time</th><th>Field</th><th>Div</th><th>Matchup</th>'
      + '<th style="text-align:right">Fee</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + '<table class="p-sum"><tbody>'
      + '<tr><td>Matches worked</td><td class="p-sum-v">' + n + '</td></tr>'
      + '<tr><td>Rate per game</td><td class="p-sum-v">' + (rate ? '$' + rate.toFixed(2) : '-') + '</td></tr>'
      + '<tr class="p-sum-total"><td>Total due</td><td class="p-sum-v">' + (rate ? '$' + total.toFixed(2) : '-') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="p-sign"><div class="p-sign-line"></div><div class="p-sign-lbl">Official signature</div></div>'
      + '<div class="p-foot">Arbiter numbers come from the Arbiter Sports assigning app. '
      + (missing ? missing + ' match' + (missing===1?'':'es') + ' on this sheet still need a number.' : 'All matches on this sheet have a number.')
      + '</div></div>';
  }

  function printOfficialSheets(keys, rate){
    const list = officialIndex();
    let chosen = list;
    if(keys && keys.length) chosen = list.filter(o=>keys.indexOf(o.key) > -1);
    if(!chosen.length){ toast('No officials to print'); return; }
    $('#print-area').innerHTML = chosen.map((o,i)=> officialSheetHtml(o, rate, i>0)).join('');
    window.print();
  }

  $('#btnPrintAllOff').addEventListener('click', ()=>{
    printOfficialSheets(null, offPayRate());
  });

  const rateBox = $('#prRate3');
  if(rateBox){
    rateBox.addEventListener('input', renderOffPayList);
    rateBox.addEventListener('change', renderOffPayList);
  }

  /* ---------------- render all ---------------- */
  function renderAll(){
    renderBoard();
    renderTray();
    renderPool();
    fillTeamsTab();
    fillPrintTab();
    fillSettingsTab();
    renderOfficials();
  }

  // keyboard: escape closes drawer
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeEditor(); });
})();
