/* ===== Public schedule page ===== */
(function(){
  const D = SD.loadPublic();
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* Girls and boys are two separate pools. A team name can exist in both
     divisions (Duncan, Altus, Guymon...), so every team reference carries
     its division with it. */
  const state = {
    team:'',        // team name
    teamG:'',       // division of the selected team ('G' or 'B')
    field:'',
    gender: SD.divisionFromUrl(),   // '' | 'G' | 'B'
    search:'',
    view:'grid',
    onlyMine:false
  };

  /* ---------- header ---------- */
  $('#evTitle').textContent = D.event.title;
  $('#evSub').textContent = D.event.subtitle + (D.event.date ? ' \u00b7 ' + D.event.date : '');
  $('#evVenue').textContent = D.event.venue || '';

  const girlsSet = new Set((D.teams && D.teams.G) || []);
  const boysSet  = new Set((D.teams && D.teams.B) || []);

  /* ---------- team select (rebuilt whenever the division changes) ---------- */
  const teamSel = $('#fTeam');

  function fillTeams(){
    const prev = state.team && state.teamG ? SD.teamKey(state.teamG, state.team) : '';
    teamSel.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = state.gender === 'G' ? 'All girls teams'
                    : state.gender === 'B' ? 'All boys teams'
                    : 'All teams (show everything)';
    teamSel.appendChild(all);

    function addGroup(label, list, gender){
      if(!list.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      list.forEach(t=>{
        const o = document.createElement('option');
        o.value = SD.teamKey(gender, t);
        o.textContent = t;
        og.appendChild(o);
      });
      teamSel.appendChild(og);
    }

    if(state.gender === 'G'){
      addGroup('Girls teams', SD.teamsIn(D,'G'), 'G');
    } else if(state.gender === 'B'){
      addGroup('Boys teams', SD.teamsIn(D,'B'), 'B');
    } else {
      addGroup('Girls teams', SD.teamsIn(D,'G'), 'G');
      addGroup('Boys teams',  SD.teamsIn(D,'B'), 'B');
    }
    teamSel.value = prev && Array.from(teamSel.options).some(o=>o.value===prev) ? prev : '';
    if(!teamSel.value){ state.team = ''; state.teamG = ''; }
  }

  /* ---------- field select ---------- */
  const fieldSel = $('#fField');
  (D.fields||[]).forEach(f=>{
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.name + (f.sub ? ', ' + f.sub : '');
    fieldSel.appendChild(o);
  });

  /* ---------- filtering ---------- */
  function matchesFilters(g, ignoreTeam){
    if(state.field && g.field !== state.field) return false;
    if(state.gender && g.gender !== state.gender) return false;
    if(state.search){
      const q = state.search.toLowerCase();
      if(!((g.a||'').toLowerCase().includes(q) || (g.b||'').toLowerCase().includes(q))) return false;
    }
    if(!ignoreTeam && state.team && state.onlyMine){
      if(!isTeamGame(g)) return false;
    }
    return true;
  }
  function isTeamGame(g){
    return !!state.team && g.gender === state.teamG && (g.a === state.team || g.b === state.team);
  }

  function visibleGames(){
    return SD.sortGames(D, D.games.filter(g=>matchesFilters(g,false)));
  }
  function teamGamesOf(name, gender){ return SD.teamGames(D, name, gender); }

  /* ---------- grid ---------- */
  function renderGrid(){
    const t = $('#gridTable');
    const fields = (D.fields||[]).filter(f=>!state.field || f.id===state.field);
    let html = '<thead><tr><th class="tcol">Time</th>';
    fields.forEach(f=>{
      html += `<th>${esc(f.name)}<span class="fsub">${esc(f.sub||'')}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    (D.times||[]).forEach(time=>{
      let rowHasGame = false;
      let cells = '';
      fields.forEach(f=>{
        if(SD.isBlocked(D, f.id, time)){
          cells += '<td><div class="slot blocked">BLOCKED</div></td>';
          return;
        }
        const games = SD.gamesAt(D, f.id, time).filter(g=>matchesFilters(g,true));
        if(games.length){
          rowHasGame = true;
          cells += '<td><div class="slot">' + games.map(g=>card(g)).join('') + '</div></td>';
        } else {
          cells += '<td><div class="slot empty"></div></td>';
        }
      });
      if(rowHasGame || !state.onlyMine){
        html += `<tr><td class="timecell">${esc(time)}</td>${cells}</tr>`;
      }
    });
    html += '</tbody>';
    t.innerHTML = html;

    const n = visibleGames().length;
    $('#countLabel').textContent = n + (n===1?' match':' matches')
      + (state.gender ? ' \u00b7 ' + (state.gender==='G'?'Girls':'Boys') : '')
      + (state.team && state.onlyMine ? ' for ' + state.team : '');
  }

  function card(g){
    const cls = g.gender==='G' ? 'girls' : 'boys';
    const dim = state.team && !isTeamGame(g) && !state.onlyMine ? ' dim' : '';
    const hit = isTeamGame(g) ? ' hit' : '';
    const f = SD.fieldName(D, g.field);
    return `<div class="game ${cls}${dim}${hit}">
      <div class="g-top">
        <span class="badge ${g.gender==='G'?'g':''}">${g.gender==='G'?'Girls':'Boys'}</span>
        <span class="gnum">${esc(g.time)} \u00b7 ${esc(f)}</span>
      </div>
      <div class="g-teams">${esc(g.a)}<span class="vs">vs</span>${esc(g.b)}</div>
      <div class="g-loc">${esc(SD.fieldLabel(D,g.field))}</div>
    </div>`;
  }

  /* ---------- list ---------- */
  function renderList(){
    const games = visibleGames();
    const b = $('#listBody');
    if(!games.length){
      b.innerHTML = `<div class="empty-state"><div class="big">\ud83d\udd0d</div>No matches match your filters.</div>`;
      return;
    }
    let html = `<div class="lrow head"><div>Time</div><div>Field</div><div>Matchup</div><div>Location</div><div>Div</div></div>`;
    games.forEach(g=>{
      const hit = isTeamGame(g) ? ' hit' : '';
      html += `<div class="lrow${hit}">
        <div class="lt">${esc(g.time)}</div>
        <div class="lf">${esc(SD.fieldName(D,g.field))}</div>
        <div class="lteams">${esc(g.a)}<span class="vs">vs</span>${esc(g.b)}</div>
        <div class="lf">${esc(SD.fieldLabel(D,g.field))}</div>
        <div class="lnum">${g.gender==='G'?'Girls':'Boys'}</div>
      </div>`;
    });
    b.innerHTML = html;
    $('#countLabel').textContent = games.length + (games.length===1?' match':' matches');
  }

  /* ---------- team view (girls and boys kept apart) ---------- */
  function teamCard(t, gender){
    const gs = teamGamesOf(t, gender);
    const rows = gs.map(g=>`<div class="trow">
        <span class="opp">${esc(SD.opponentOf(g,t))}</span>
        <span class="meta">${esc(g.time)} \u00b7 ${esc(SD.fieldName(D,g.field))}</span>
      </div>`).join('') || '<div class="trow"><span class="meta">No games scheduled</span></div>';
    return `<div class="tcard ${gender==='G'?'g':'b'}"><div class="th">${esc(t)}</div><div class="tb">${rows}</div></div>`;
  }

  function renderTeamView(){
    const b = $('#teamBody');
    const sections = [];
    const wantG = state.gender !== 'B';
    const wantB = state.gender !== 'G';

    if(wantG){
      const list = state.team && state.teamG==='G' ? [state.team] : SD.teamsIn(D,'G');
      if(list.length){
        sections.push(`<div class="divsec"><div class="divsec-head girls"><span>Girls Division</span>
          <span class="divsec-count">${list.length} teams</span></div>
          <div class="teamgrid">${list.map(t=>teamCard(t,'G')).join('')}</div></div>`);
      }
    }
    if(wantB){
      const list = state.team && state.teamG==='B' ? [state.team] : SD.teamsIn(D,'B');
      if(list.length){
        sections.push(`<div class="divsec"><div class="divsec-head boys"><span>Boys Division</span>
          <span class="divsec-count">${list.length} teams</span></div>
          <div class="teamgrid">${list.map(t=>teamCard(t,'B')).join('')}</div></div>`);
      }
    }
    b.innerHTML = sections.join('') || '<div class="empty-state">No teams.</div>';
  }

  /* ---------- division switcher ---------- */
  function syncDivButtons(){
    $$('#divSeg button').forEach(b=>{
      b.classList.toggle('on', (b.dataset.d||'') === state.gender);
    });
    const note = $('#divNote');
    if(state.gender === 'G') note.textContent = 'Showing the girls division only';
    else if(state.gender === 'B') note.textContent = 'Showing the boys division only';
    else note.textContent = 'Girls and boys are separate divisions. Pick one to narrow the schedule';
  }

  /* ---------- render all ---------- */
  function render(){
    const banner = $('#teamBanner');
    if(state.team){
      banner.classList.add('show');
      const gs = teamGamesOf(state.team, state.teamG);
      $('#tbName').textContent = state.team;
      $('#tbMeta').textContent = (state.teamG==='G'?'Girls':'Boys') + ' \u00b7 ' + gs.length + ' games \u00b7 ' +
        gs.map(g=>g.time + ' on ' + SD.fieldName(D,g.field)).join(' \u00b7 ');
      $('#btnOnlyMine').textContent = state.onlyMine ? 'Show all games' : 'Show only my games';
    } else {
      banner.classList.remove('show');
    }

    if(state.view==='grid'){ $('#viewGrid').style.display=''; $('#viewList').style.display='none'; $('#viewTeam').style.display='none'; renderGrid(); }
    else if(state.view==='list'){ $('#viewGrid').style.display='none'; $('#viewList').style.display=''; $('#viewTeam').style.display='none'; renderList(); }
    else { $('#viewGrid').style.display='none'; $('#viewList').style.display='none'; $('#viewTeam').style.display=''; renderTeamView(); }

    $('#viewHint').textContent = state.view==='team'
      ? 'Each team and their three opponents, girls and boys listed separately.'
      : (state.team ? 'Your games are highlighted.' : '');
    syncDivButtons();
  }

  /* ---------- print ---------- */
  function printGames(title, subtitle, games, showNum){
    const rows = games.map(g=>`<tr>
        <td class="p-num">${showNum && g.num ? '#'+esc(g.num) : ''}</td>
        <td>${esc(g.time)}</td>
        <td>${esc(SD.fieldLabel(D,g.field))}</td>
        <td class="p-g">${g.gender==='G'?'Girls':'Boys'}</td>
        <td>${esc(g.a)} vs ${esc(g.b)}</td>
      </tr>`).join('');
    $('#print-area').innerHTML = `
      <div class="print-head">
        <img src="crest.png" alt="">
        <div>
          <div class="ph-t">${esc(title)}</div>
          <div class="ph-s">${esc(subtitle)}</div>
        </div>
      </div>
      <table class="p-table">
        <thead><tr><th></th><th>Time</th><th>Field</th><th>Division</th><th>Matchup</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="p-foot">${esc(D.event.title)} \u00b7 ${esc(D.event.venue||'')} \u00b7 ${games.length} matches</div>`;
    window.print();
  }


  function printGrid(title, subtitle, games){
    const fields = (D.fields||[]).filter(f=>!state.field || f.id===state.field);
    const set = new Set(games.map(g=>g.id));
    let head = '<tr><th class="pg-time">Time</th>';
    fields.forEach(f=>{
      head += '<th>' + esc(f.name) + (f.sub ? '<span class="pg-sub">' + esc(f.sub) + '</span>' : '') + '</th>';
    });
    head += '</tr>';

    let body = '';
    (D.times||[]).forEach(time=>{
      let any = false;
      let cells = '';
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
      + '<div class="print-head">'
      + '<img src="crest.png" alt="">'
      + '<div><div class="ph-t">' + esc(title) + '</div>'
      + '<div class="ph-s">' + esc(subtitle) + '</div></div></div>'
      + '<table class="p-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>'
      + '<div class="p-foot">' + esc(D.event.title) + ' \u00b7 ' + esc(D.event.date||'') + ' \u00b7 '
      + esc(D.event.venue||'') + ' \u00b7 ' + games.length + ' matches</div>';
    window.print();
  }

  /* ---------- events ---------- */
  teamSel.addEventListener('change', e=>{
    const k = SD.parseTeamKey(e.target.value);
    state.team = k.name;
    state.teamG = k.gender;
    if(state.team){
      state.gender = k.gender;      // selecting a team locks to its division
      state.onlyMine = true;        // and shows just that team's games
      fillTeams();
    } else {
      state.onlyMine = false;
    }
    render();
  });

  fieldSel.addEventListener('change', e=>{ state.field = e.target.value; render(); });
  $('#fSearch').addEventListener('input', e=>{ state.search = e.target.value.trim(); render(); });

  $$('#divSeg button').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.gender = b.dataset.d || '';
      state.team = ''; state.teamG = ''; state.onlyMine = false;
      fillTeams();
      render();
    });
  });

  $$('#viewSeg button').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('#viewSeg button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      state.view = b.dataset.v;
      render();
    });
  });

  $('#btnReset').addEventListener('click', ()=>{
    state.team=''; state.teamG=''; state.field=''; state.gender=''; state.search=''; state.onlyMine=false;
    fieldSel.value=''; $('#fSearch').value='';
    fillTeams();
    render();
  });

  $('#btnOnlyMine').addEventListener('click', ()=>{
    state.onlyMine = !state.onlyMine;
    render();
  });

  $('#btnPrint').addEventListener('click', ()=>{
    const games = visibleGames();
    const bits = [];
    if(state.team) bits.push(state.team);
    if(state.gender) bits.push(state.gender==='G'?'Girls division':'Boys division');
    if(state.field) bits.push(SD.fieldLabel(D,state.field));
    printGames('Match Day Schedule', bits.length?bits.join(' \u00b7 '):'All matches', games, false);
  });

  $('#btnPrintGrid').addEventListener('click', ()=>{
    const games = visibleGames();
    const bits = [];
    if(state.team) bits.push(state.team);
    if(state.gender) bits.push(state.gender==='G'?'Girls division':'Boys division');
    if(state.field) bits.push(SD.fieldLabel(D,state.field));
    printGrid('Match Day Schedule', bits.length?bits.join(' \u00b7 '):'All matches, all fields', games);
  });

  $('#btnPrintTeam').addEventListener('click', ()=>{
    if(!state.team) return;
    const gs = teamGamesOf(state.team, state.teamG);
    printGames(state.team + ' Schedule',
      (state.teamG==='G'?'Girls':'Boys') + ' division \u00b7 your three matches and field locations', gs, false);
  });

  $('#btnPrintG').addEventListener('click', ()=>{
    const games = SD.sortGames(D, D.games.filter(g=>g.gender==='G'));
    printGames('Girls Division Match Day Schedule', 'All girls matches, all fields', games, false);
  });
  $('#btnPrintB').addEventListener('click', ()=>{
    const games = SD.sortGames(D, D.games.filter(g=>g.gender==='B'));
    printGames('Boys Division Match Day Schedule', 'All boys matches, all fields', games, false);
  });

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  fillTeams();
  render();
})();
