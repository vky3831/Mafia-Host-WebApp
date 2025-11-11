// Mafia Host - client-only app using localStorage (v2)
(() => {
  const roleDefs = {
    "Mafia":"A secret killer. Works with other mafia to eliminate villagers.",
    "Villager":"No special power. Vote to find mafia.",
    "Gambler":"Can gamble during night for a chance to survive or lose.",
    "Bomber":"Can plant a bomb on someone.",
    "Jester":"Wins if voted out.",
    "Sheriff":"Can investigate one player at night.",
    "Doctor":"Can save someone at night."
  };

  // DOM refs
  const rolesList = document.getElementById('rolesList');
  const newGameForm = document.getElementById('newGameForm');
  const numPlayersInput = document.getElementById('numPlayers');
  const passkeyInput = document.getElementById('passkey');
  const flushBtn = document.getElementById('flushBtn');
  const continueMsg = document.getElementById('continueMsg');
  const homeNewBtn = document.getElementById('homeNewBtn');
  const homeContinueBtn = document.getElementById('homeContinueBtn');
  const clearStorageBtn = document.getElementById('clearStorage');
  const assignView = document.getElementById('assignView');
  const homeView = document.getElementById('homeView');
  const newGameView = document.getElementById('newGameView');
  const assignCounter = document.getElementById('playerCounter');
  const totalPlayersLabel = document.getElementById('totalPlayers');
  const playerNameInput = document.getElementById('playerName');
  const revealRoleBtn = document.getElementById('revealRoleBtn');
  const roleReveal = document.getElementById('roleReveal');
  const assignedRoleEl = document.getElementById('assignedRole');
  const assignedDescEl = document.getElementById('assignedDesc');
  const nextPlayerBtn = document.getElementById('nextPlayerBtn');
  const enterPassView = document.getElementById('enterPassView');
  const dashPass = document.getElementById('dashPass');
  const openDashBtn = document.getElementById('openDashBtn');
  const dashboardView = document.getElementById('dashboardView');
  const playersTableBody = document.querySelector('#playersTable tbody');
  const bombHead = document.getElementById('bombHead'), gamblerHead=document.getElementById('gamblerHead');
  const helpBtn = document.getElementById('helpBtn');
  const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
  const helpBody = document.getElementById('helpBody');
  const themeToggle = document.getElementById('themeToggle');
  const topbar = document.getElementById('topbar');
  const nextRoundBtn = document.getElementById('nextRoundBtn');
  const saveGameBtn = document.getElementById('saveGameBtn');
  const revealPassBtn = document.getElementById('revealPassBtn');
  const passAlert = document.getElementById('passAlert');
  const backToHomeFromNew = document.getElementById('backToHomeFromNew');

  // state
  let game = null;
  let assignIndex = 0;
  let shuffleRoles = [];

  // initialize role UI
  function initRolesUI(){
    rolesList.innerHTML='';
    for(const r of Object.keys(roleDefs)){
      const id = 'chk_'+r;
      rolesList.insertAdjacentHTML('beforeend', `
        <div class="col-12 col-md-6">
          <div class="input-group">
            <div class="input-group-text">
              <input class="form-check-input mt-0 role-checkbox" type="checkbox" id="${id}" data-role="${r}">
            </div>
            <label class="form-control d-flex justify-content-between align-items-center">
              <span>${r}</span>
              <span class="d-flex gap-2 align-items-center">
                <button class="btn btn-sm btn-outline-secondary desc-btn" data-role="${r}" type="button">?</button>
                <input type="number" min="0" value="0" class="form-control form-control-sm role-count" data-role="${r}" style="width:80px" disabled>
              </span>
            </label>
          </div>
        </div>
      `);
    }
    // add listeners
    document.querySelectorAll('.role-checkbox').forEach(cb=>{
      cb.addEventListener('change', e=>{
        const role = e.target.dataset.role;
        const input = document.querySelector('.role-count[data-role="'+role+'"]');
        input.disabled = !e.target.checked;
        if(!e.target.checked) input.value = 0;
        updateTotalCheck();
        autoPersistPartial(); // ensure change persisted
      });
    });
    document.querySelectorAll('.role-count').forEach(inp=>{
      inp.addEventListener('input', ()=>{ updateTotalCheck(); autoPersistPartial(); });
    });
    document.querySelectorAll('.desc-btn').forEach(b=>{
      b.addEventListener('click', ()=>{
        const r = b.dataset.role;
        alert(r + " — " + roleDefs[r]);
      });
    });
  }

  function updateTotalCheck(){
    const numPlayers = +numPlayersInput.value || 0;
    let sum=0;
    document.querySelectorAll('.role-count').forEach(inp=> sum += +(inp.value||0));
    if(sum !== numPlayers){
      if(!document.getElementById('sumWarn')){
        const el = document.createElement('div'); el.id='sumWarn'; el.className='text-danger mt-2';
        el.innerText = `Total assigned characters (${sum}) must equal number of players (${numPlayers}).`;
        newGameForm.appendChild(el);
      } else {
        document.getElementById('sumWarn').innerText = `Total assigned characters (${sum}) must equal number of players (${numPlayers}).`;
      }
    } else {
      const ex = document.getElementById('sumWarn'); if(ex) ex.remove();
    }
  }

  initRolesUI();

  // theme
  function applyTheme(dark){
    if(dark){ document.body.classList.add('dark'); document.querySelectorAll('.card').forEach(c=>c.classList.add('dark')); }
    else { document.body.classList.remove('dark'); document.querySelectorAll('.card.dark').forEach(c=>c.classList.remove('dark')); }
    localStorage.setItem('mafia_theme_dark', dark? '1':'0');
    themeToggle.checked = dark;
  }
  themeToggle.addEventListener('change', ()=> applyTheme(themeToggle.checked));
  applyTheme(localStorage.getItem('mafia_theme_dark')==='1');

  // helper: persist partial form state so user doesn't lose selections if they refresh before submitting
  function autoPersistPartial(){
    const partial = {
      passkey: passkeyInput.value || '',
      numPlayers: +numPlayersInput.value || 0,
      rolesForm: {}
    };
    document.querySelectorAll('.role-checkbox').forEach(cb=>{
      const r = cb.dataset.role; if(cb.checked) partial.rolesForm[r] = +document.querySelector('.role-count[data-role="'+r+'"]').value || 0;
    });
    localStorage.setItem('mafia_partial', JSON.stringify(partial));
  }

  // flush existing game
  function flushExisting(){
    localStorage.removeItem('mafia_game');
    localStorage.removeItem('mafia_partial');
    flushPassAttempts();
    updateContinuePane();
  }

  function flushPassAttempts(){
    localStorage.removeItem('mafia_pass_attempts');
  }
  flushBtn.addEventListener('click', ()=>{ if(confirm('Flush existing saved game?')){ flushExisting(); alert('Flushed.'); } });

  // home buttons
  homeNewBtn.addEventListener('click', ()=>{
    // flush existing and show new game screen
    if(confirm('Start a new game? This will remove any saved game.')){
      flushExisting();
      showNewGame();
    }
  });
  homeContinueBtn.addEventListener('click', ()=>{
    const g = localStorage.getItem('mafia_game');
    if(!g){ alert('No existing game found'); return; }
    game = JSON.parse(g);
    if(game.players && game.players.length === game.numPlayers){
      showEnterPass();
    } else {
      // if not fully assigned, resume assignment view
      startAssignment(true);
    }
  });

  // continue pane message
  function updateContinuePane(){
    const g = localStorage.getItem('mafia_game');
    if(!g){ continueMsg.innerHTML = '<div class="text-muted">No existing game found.</div>'; }
    else{ continueMsg.innerHTML = '<div>Saved game found. Click Continue Game to resume.</div>'; }
  }
  updateContinuePane();

  // new game screen handlers
  backToHomeFromNew.addEventListener('click', ()=>{ showHome(); });

  newGameForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const pass = passkeyInput.value || '';
    const num = +numPlayersInput.value || 0;
    // read chosen roles
    const selected = {};
    document.querySelectorAll('.role-checkbox:checked').forEach(cb=>{
      const r = cb.dataset.role;
      const cnt = +document.querySelector('.role-count[data-role="'+r+'"]').value || 0;
      if(cnt >0) selected[r]=cnt;
    });
    const sum = Object.values(selected).reduce((a,b)=>a+b,0);
    if(sum !== num){ alert('Total characters count must equal number of players.'); return; }
    if(num <=0){ alert('Number of players must be > 0'); return; }
    // create game object
    game = {
      passkey:pass,
      numPlayers:num,
      roles:selected,
      players:[],
      createdAt: Date.now(),
      settings:{ themeDark: localStorage.getItem('mafia_theme_dark')==='1' }
    };
    localStorage.setItem('mafia_game', JSON.stringify(game));
    localStorage.removeItem('mafia_partial');
    startAssignment();
  });

  function showHome(){ homeView.classList.remove('d-none'); newGameView.classList.add('d-none'); assignView.classList.add('d-none'); enterPassView.classList.add('d-none'); dashboardView.classList.add('d-none'); updateContinuePane(); }
  function showNewGame(){ homeView.classList.add('d-none'); newGameView.classList.remove('d-none'); assignView.classList.add('d-none'); enterPassView.classList.add('d-none'); dashboardView.classList.add('d-none'); // load partial if any
    const part = (localStorage.getItem('mafia_partial') && JSON.parse(localStorage.getItem('mafia_partial'))) || null;
    if(part){ passkeyInput.value = part.passkey||''; numPlayersInput.value = part.numPlayers||5; document.querySelectorAll('.role-checkbox').forEach(cb=>{ const r=cb.dataset.role; if(part.rolesForm && part.rolesForm[r]){ cb.checked=true; document.querySelector('.role-count[data-role="'+r+'"]').disabled=false; document.querySelector('.role-count[data-role="'+r+'"]').value=part.rolesForm[r]; } else { cb.checked=false; document.querySelector('.role-count[data-role="'+r+'"]').disabled=true; document.querySelector('.role-count[data-role="'+r+'"]').value=0; } }); updateTotalCheck(); }
  }

  function startAssignment(fromSaved=false){
    const stored = JSON.parse(localStorage.getItem('mafia_game') || '{}');
    if(!fromSaved) stored.players = stored.players || [];
    game = stored;
    // build role array and shuffle if not already
    shuffleRoles=[];
    for(const [r,c] of Object.entries(game.roles||{})){
      for(let i=0;i<c;i++) shuffleRoles.push(r);
    }
    shuffleArray(shuffleRoles);
    assignIndex = game.players ? game.players.length : 0;
    document.getElementById('totalPlayers').innerText = game.numPlayers;
    document.getElementById('playerCounter').innerText = assignIndex+1;
    homeView.classList.add('d-none'); newGameView.classList.add('d-none'); assignView.classList.remove('d-none');
    roleReveal.classList.add('d-none');
    playerNameInput.value='';
    persist(); // ensure any changes saved
  }

  revealRoleBtn.addEventListener('click', ()=>{
    const name = (playerNameInput.value||'').trim();
    const feedback = document.getElementById('nameFeedback');
    if(!name){ alert('Enter a name'); return; }
    if(game.players.find(p=>p.name.toLowerCase()===name.toLowerCase())){ feedback.classList.remove('d-none'); return; }
    feedback.classList.add('d-none');
    if(assignIndex >= shuffleRoles.length){ alert('All roles already assigned'); return; }
    const role = shuffleRoles[assignIndex];
    assignedRoleEl.innerText = role;
    assignedDescEl.innerText = roleDefs[role] || '';
    roleReveal.classList.remove('d-none');
    game.players.push({
      name:name,
      role:role,
      votes:0,
      alive:true,
      onTarget:false,
      saved:false,
      bomb:false,
      gambled:false
    });
    persist();
  });

  nextPlayerBtn.addEventListener('click', ()=>{
    assignIndex++;
    if(assignIndex >= game.numPlayers){
      assignView.classList.add('d-none');
      showEnterPass();
      return;
    }
    document.getElementById('playerCounter').innerText = assignIndex+1;
    roleReveal.classList.add('d-none');
    playerNameInput.value='';
    persist();
  });

  function showEnterPass(){
    enterPassView.classList.remove('d-none');
    dashPass.value='';
    revealPassBtn.classList.add('d-none');
    passAlert.classList.add('d-none');
    homeView.classList.add('d-none');
    newGameView.classList.add('d-none');
    assignView.classList.add('d-none');
    dashboardView.classList.add('d-none');
  }

  // pass attempts logic
  function incPassAttempt(){
    const key = 'mafia_pass_attempts';
    const v = +(localStorage.getItem(key)||'0') + 1;
    localStorage.setItem(key, String(v));
    if(v>=5){ revealPassBtn.classList.remove('d-none'); revealPassBtn.addEventListener('click', ()=>{
      flushPassAttempts();
      revealPassBtn.classList.add('d-none');
      window.alert('Correct passkey: ' + (game.passkey || '(empty)'));
    }); }
  }

  openDashBtn.addEventListener('click', ()=>{
    const entered = dashPass.value || '';
    if(entered !== (game.passkey||'')){
      passAlert.classList.remove('d-none');
      incPassAttempt();
      return;
    }
    passAlert.classList.add('d-none');
    enterPassView.classList.add('d-none');
    showDashboard();
  });

  function showDashboard(){
    dashboardView.classList.remove('d-none');
    renderTable();
  }

  function renderTable(){
    playersTableBody.innerHTML='';
    const hasBomber = !!(game.roles && game.roles['Bomber']);
    const hasGambler = !!(game.roles && game.roles['Gambler']);
    if(hasBomber) bombHead.classList.remove('d-none'); else bombHead.classList.add('d-none');
    if(hasGambler) gamblerHead.classList.remove('d-none'); else gamblerHead.classList.add('d-none');

    game.players.forEach((p, idx)=>{
      const tr = document.createElement('tr');
      tr.dataset.index = idx;
      const votesTd = document.createElement('td');
      votesTd.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary vote-dec">-</button>
          <span class="vote-count">${p.votes}</span>
          <button class="btn btn-sm btn-outline-secondary vote-inc">+</button>
        </div>`;
      const nameTd = document.createElement('td'); nameTd.innerText = p.name;
      const roleTd = document.createElement('td'); roleTd.innerText = p.role;
      const aliveTd = document.createElement('td');
      aliveTd.innerHTML = `<div class="form-check form-switch"><input class="form-check-input alive-toggle" type="checkbox" ${p.alive ? 'checked':''}></div>`;
      const onTargetTd = document.createElement('td');
      onTargetTd.innerHTML = `<div class="form-check form-switch"><input class="form-check-input ontarget-toggle" type="checkbox" ${p.onTarget ? 'checked':''}></div>`;
      const savedTd = document.createElement('td');
      savedTd.innerHTML = `<div class="form-check form-switch"><input class="form-check-input saved-toggle" type="checkbox" ${p.saved ? 'checked':''}></div>`;
      const bombTd = document.createElement('td'); bombTd.classList.add('bomb-col'); bombTd.innerHTML = `<div class="form-check form-switch"><input class="form-check-input bomb-toggle" type="checkbox" ${p.bomb ? 'checked':''}></div>`;
      const gambTd = document.createElement('td'); gambTd.classList.add('gamb-col'); gambTd.innerHTML = `<div class="form-check form-switch"><input class="form-check-input gamb-toggle" type="checkbox" ${p.gambled ? 'checked':''}></div>`;

      tr.appendChild(votesTd); tr.appendChild(nameTd); tr.appendChild(roleTd); tr.appendChild(aliveTd);
      tr.appendChild(onTargetTd); tr.appendChild(savedTd);
      if(hasBomber) tr.appendChild(bombTd);
      if(hasGambler) tr.appendChild(gambTd);

      applyRowColor(tr, p);

      // listeners with immediate persist
      votesTd.querySelector('.vote-inc').addEventListener('click', ()=>{
        if(!p.alive){ alert('Dead cannot be voted'); return; }
        p.votes++; votesTd.querySelector('.vote-count').innerText = p.votes; persist();
      });
      votesTd.querySelector('.vote-dec').addEventListener('click', ()=>{
        if(!p.alive){ alert('Dead cannot be voted'); return; }
        p.votes--; votesTd.querySelector('.vote-count').innerText = p.votes; persist();
      });
      aliveTd.querySelector('.alive-toggle').addEventListener('change', (e)=>{
        p.alive = e.target.checked;
        if(!p.alive){
          p.onTarget=false; p.saved=false; p.bomb=false; p.gambled=false;
        }
        applyRowColor(tr,p);
        renderTable();
        persist();
      });
      onTargetTd.querySelector('.ontarget-toggle').addEventListener('change', (e)=>{
        if(!p.alive && e.target.checked){ alert('Dead cannot be set On Target'); e.target.checked=false; return; }
        p.onTarget = e.target.checked; applyRowColor(tr,p); persist();
      });
      savedTd.querySelector('.saved-toggle').addEventListener('change', (e)=>{
        if(!p.alive && e.target.checked){ alert('Dead cannot be Saved'); e.target.checked=false; return; }
        p.saved = e.target.checked; applyRowColor(tr,p); persist();
      });
      if(hasBomber){
        bombTd.querySelector('.bomb-toggle').addEventListener('change', (e)=>{
          if(!p.alive && e.target.checked){ alert('Dead cannot have bomb planted'); e.target.checked=false; return; }
          p.bomb = e.target.checked; applyRowColor(tr,p); persist();
        });
      }
      if(hasGambler){
        gambTd.querySelector('.gamb-toggle').addEventListener('change', (e)=>{
          if(!p.alive && e.target.checked){ alert('Dead cannot gamble'); e.target.checked=false; return; }
          p.gambled = e.target.checked; applyRowColor(tr,p); persist();
        });
      }

      playersTableBody.appendChild(tr);
    });
  }

  function applyRowColor(tr, p){
    if(!p.alive) { tr.style.background = 'var(--dead)'; return; }
    const colors = [];
    if(p.onTarget) colors.push('var(--ontarget)');
    if(p.saved) colors.push('var(--saved)');
    if(p.bomb) colors.push('var(--bomb)');
    if(p.gambled) colors.push('var(--gambled)');
    if(colors.length===0) tr.style.background = 'var(--alive)';
    else if(colors.length===1) tr.style.background = colors[0];
    else {
      tr.style.background = `linear-gradient(90deg, ${colors.map((c,i)=>c + ' ' + (i*100/colors.length) + '%').join(',')})`;
    }
  }

  function persist(){ localStorage.setItem('mafia_game', JSON.stringify(game)); updateContinuePane(); }

  function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

  // help modal content
  function populateHelp(){
    helpBody.innerHTML='';
    for(const [r,d] of Object.entries(roleDefs)){
      helpBody.insertAdjacentHTML('beforeend', `<div class="mb-2"><strong>${r}</strong><div class="role-desc">${d}</div></div>`);
    }
  }
  helpBtn.addEventListener('click', ()=>{ populateHelp(); helpModal.show(); });

  // maybe auto-open saved game if fully assigned
  function maybeAutoOpenSaved(){
    const g = (localStorage.getItem('mafia_game') && JSON.parse(localStorage.getItem('mafia_game'))) || null;
    if(!g) return;
    if(g.players && g.players.length === g.numPlayers){
      game = g;
      showEnterPass();
    } else updateContinuePane();
  }
  maybeAutoOpenSaved();

  // next round button: reset all toggles to default except Dead/Alive; reset votes to zero
  nextRoundBtn.addEventListener('click', ()=>{
    if(!game) return;
    game.players.forEach(p=>{
      p.votes = 0;
      p.onTarget = false;
      p.saved = false;
      p.bomb = false;
      p.gambled = false;
    });
    persist();
    renderTable();
  });

  saveGameBtn.addEventListener('click', ()=>{ persist(); alert('Saved to localStorage'); });

  // ensure form partial autosave when inputs change
  document.getElementById('numPlayers').addEventListener('input', autoPersistPartial);
  document.getElementById('passkey').addEventListener('input', autoPersistPartial);

  // start on home
  showHome();
  // persist on unload
  window.addEventListener('beforeunload', ()=>{ if(game) persist(); });
})();
