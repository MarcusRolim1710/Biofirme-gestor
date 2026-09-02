document.addEventListener('DOMContentLoaded', function() {
  // 0. Formatadores
  function formatCPF(value) {
    const d = (value || '').replace(/\D+/g, '');
    if (d.length !== 11) return value || '-';
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9, 11);
  }
  function formatRG(value) {
    const d = (value || '').replace(/\D+/g, '');
    if (d.length < 7) return value || '';
    if (d.length <= 8) return d.slice(0, d.length - 6) + '.' + d.slice(d.length - 6, d.length - 3) + '.' + d.slice(-3);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '-' + d.slice(8);
  }
  function formatCEP(value) {
    const d = (value || '').replace(/\D+/g, '');
    if (d.length !== 8) return value || '';
    return d.slice(0, 5) + '-' + d.slice(5, 8);
  }
  function formatAddress(emp) {
    if (!emp) return '';
    const parts = [];
    if (emp.logradouro) {
      parts.push(emp.logradouro + (emp.numero ? ', ' + emp.numero : ''));
    }
    if (emp.complemento) parts.push(emp.complemento);
    if (emp.bairro) parts.push(emp.bairro);
    const city = [emp.cidade, emp.uf].filter(Boolean).join(' - ');
    if (city) parts.push(city);
    if (emp.cep) parts.push('CEP: ' + formatCEP(emp.cep));
    return parts.join(' · ');
  }

  // 1. Verificação de Sessão
  const userData = JSON.parse(sessionStorage.getItem('biofirm_user') || 'null');
  if (!userData) {
    window.location.href = 'index.html';
    return;
  }

  // Preenchimento de dados do usuário logado
  const userRoleEl = document.getElementById('userRole');
  const userNameEl = document.getElementById('userName');
  const userAccessTagEl = document.getElementById('userAccessTag');
  
  if (userRoleEl) userRoleEl.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Gestor';
  if (userNameEl) userNameEl.textContent = userData.username || 'Usuário';
  if (userAccessTagEl) userAccessTagEl.textContent = userData.role === 'gestor' ? 'Acesso Master' : 'Acesso ' + userData.role;

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      await logout();
      window.location.href = 'index.html';
    });
  }

  // Estado Local
  let employees = [];
  let selectedEmployeeId = null;

  // Elementos do DOM
  const tbody = document.getElementById('employeeList');
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const filterVinculo = document.getElementById('filterVinculo');
  const statTotal = document.getElementById('statTotal');
  const statAtivos = document.getElementById('statAtivos');
  const statPendentes = document.getElementById('statPendentes');
  const statAprovados = document.getElementById('statAprovados');
  const detailContent = document.getElementById('detailContent');

  // Modais
  const employeeModal = document.getElementById('employeeModal');
  const viewModal = document.getElementById('viewModal');
  const btnOpenModal = document.getElementById('btnOpenModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnCloseViewModal = document.getElementById('btnCloseViewModal');
  const btnCloseViewBtn = document.getElementById('btnCloseViewBtn');
  const employeeForm = document.getElementById('employeeForm');
  const modalFormTitle = document.getElementById('modalFormTitle');

  // Form Inputs
  const empIdInput = document.getElementById('empId');
  const empNameInput = document.getElementById('empName');
  const empCpfInput = document.getElementById('empCpf');
  const empRgInput = document.getElementById('empRg');
  const empCargoInput = document.getElementById('empCargo');
  const empSetorInput = document.getElementById('empSetor');
  const empVinculoInput = document.getElementById('empVinculo');
  const empStatusInput = document.getElementById('empStatus');
  const empCepInput = document.getElementById('empCep');
  const empLogradouroInput = document.getElementById('empLogradouro');
  const empNumeroInput = document.getElementById('empNumero');
  const empComplementoInput = document.getElementById('empComplemento');
  const empBairroInput = document.getElementById('empBairro');
  const empCidadeInput = document.getElementById('empCidade');
  const empUfInput = document.getElementById('empUf');
  // Novos campos cadastro completo
  const empCtpsNumeroInput = document.getElementById('empCtpsNumero');
  const empPisInput = document.getElementById('empPis');
  const empFotoInput = document.getElementById('empFoto');
  const empFotoUrlInput = document.getElementById('empFotoUrl');
  const fotoPreviewWrap = document.getElementById('fotoPreviewWrap');
  const fotoInfo = document.getElementById('fotoInfo');
  const empRgFrenteInput = document.getElementById('empRgFrente');
  const empRgVersoInput = document.getElementById('empRgVerso');
  const empCpfDocInput = document.getElementById('empCpfDoc');
  const empCompEndInput = document.getElementById('empCompEnd');
  const empCtpsDocInput = document.getElementById('empCtpsDoc');
  const empRgFrenteUrlInput = document.getElementById('empRgFrenteUrl');
  const empRgVersoUrlInput = document.getElementById('empRgVersoUrl');
  const empCpfDocUrlInput = document.getElementById('empCpfDocUrl');
  const empCompEndUrlInput = document.getElementById('empCompEndUrl');
  const empCtpsDocUrlInput = document.getElementById('empCtpsDocUrl');
  // Cargo/Salário herdado + arquivos diversos
  const empSalarioInput = document.getElementById('empSalario');
  const cargoSalarioInfo = document.getElementById('cargoSalarioInfo');
  const divDocTipoInput = document.getElementById('divDocTipo');
  const divDocTituloInput = document.getElementById('divDocTitulo');
  const divDocFileInput = document.getElementById('divDocFile');
  const divDocInfo = document.getElementById('divDocInfo');
  const docDiversosList = document.getElementById('docDiversosList');
  const btnAddDiverso = document.getElementById('btnAddDiverso');
  let positions = [];
  let pendingDiversos = []; // {tipo,titulo,file,compressedFile} para funcionário ainda não salvo
  let employeeDiversos = []; // docs do funcionário em edição (vindos do banco)

  function formatMoneyBRL(v){
    const n = Number(v);
    if(isNaN(n)) return '-';
    return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }
  function parseMoneyBRL(str){
    if(!str) return null;
    const cleaned = str.replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  // 2a. Cargos com salário fixo
  async function fetchPositions(){
    try{
      const { data, error } = await supabaseClient.from('positions').select('*').order('nome');
      if(error) throw error;
      positions = data || [];
      renderCargoSelect();
      renderCargoList();
    }catch(err){ console.error('positions', err); }
  }
  function renderCargoSelect(){
    if(!empCargoInput) return;
    const cur = empCargoInput.value;
    empCargoInput.innerHTML = '<option value="">Selecione o cargo</option>' + positions.map(p=> `<option value="${p.id}">${p.nome}${p.setor? ' · '+p.setor:''} — ${formatMoneyBRL(p.salario_base)}</option>`).join('');
    if(cur) empCargoInput.value = cur;
  }
  function renderCargoList(){
    const wrap = document.getElementById('cargoList');
    if(!wrap) return;
    if(positions.length===0){ wrap.innerHTML='<p style="padding:12px; color:var(--color-text-muted); font-size:13px;">Nenhum cargo cadastrado. Crie o primeiro acima.</p>'; return; }
    wrap.innerHTML = positions.map(p=> `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--color-gold-light);">
        <div>
          <div style="font-weight:600; font-size:13px;">${p.nome}</div>
          <div style="font-size:11px; color:var(--color-text-muted);">${p.setor||'Sem setor'} · ${formatMoneyBRL(p.salario_base)}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn-secondary btn-small" data-cargo-edit="${p.id}">Editar</button>
          <button class="action-btn action-btn-danger" data-cargo-del="${p.id}">Excluir</button>
        </div>
      </div>
    `).join('');
    wrap.querySelectorAll('[data-cargo-edit]').forEach(btn=> btn.addEventListener('click', ()=> {
      const p = positions.find(x=> x.id==btn.getAttribute('data-cargo-edit')); if(!p) return;
      document.getElementById('cargoNome').value = p.nome;
      document.getElementById('cargoSetor').value = p.setor||'';
      document.getElementById('cargoSalario').value = formatMoneyBRL(p.salario_base).replace('R$','').trim();
      document.getElementById('cargoSalario').dataset.editId = p.id;
      if(window.BiofirmMasks) window.BiofirmMasks.bind(document.getElementById('cargoSalario'),'money');
    }));
    wrap.querySelectorAll('[data-cargo-del]').forEach(btn=> btn.addEventListener('click', async ()=> {
      const id = btn.getAttribute('data-cargo-del');
      if(!confirm('Excluir este cargo? Funcionários vinculados ficarão sem cargo_id mas mantêm cargo/salário atuais.')) return;
      const { error } = await supabaseClient.from('positions').delete().eq('id', id);
      if(error) alert('Erro: '+error.message); else await fetchPositions();
    }));
  }
  function syncSalarioFromCargo(){
    const id = empCargoInput ? empCargoInput.value : '';
    const pos = positions.find(p=> String(p.id)===String(id));
    if(pos){
      if(empSalarioInput) empSalarioInput.value = formatMoneyBRL(pos.salario_base);
      if(cargoSalarioInfo) cargoSalarioInfo.textContent = `Salário fixo: ${formatMoneyBRL(pos.salario_base)} · Setor: ${pos.setor||'-'}`;
      if(empSetorInput) empSetorInput.value = pos.setor||'';
    } else {
      if(empSalarioInput) empSalarioInput.value = '';
      if(cargoSalarioInfo) cargoSalarioInfo.textContent = 'Salário fixo definido no cargo — herdado automaticamente';
      if(empSetorInput) empSetorInput.value = '';
    }
  }
  // 2b. Arquivos diversos
  async function fetchDiversos(employeeId){
    if(!employeeId) { employeeDiversos=[]; renderDiversosList(); return; }
    const { data, error } = await supabaseClient.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at');
    if(error){ console.error(error); employeeDiversos=[]; } else employeeDiversos = data||[];
    renderDiversosList();
  }
  function renderDiversosList(){
    if(!docDiversosList) return;
    const all = [...employeeDiversos.map(d=> ({...d, _saved:true})), ...pendingDiversos.map((d,i)=> ({...d, _pendingIndex:i, _saved:false}))];
    if(all.length===0){ docDiversosList.innerHTML='<li style="font-size:12px; color:var(--color-text-muted); padding:6px;">Nenhum arquivo diverso adicionado.</li>'; return; }
    const labelTipo = { certificado:'Certificado', doc_filho:'Doc. filho', outro:'Outro' };
    docDiversosList.innerHTML = all.map((d,idx)=>{
      const isSaved = d._saved;
      const title = isSaved ? d.titulo : d.titulo;
      const tipo = isSaved ? d.tipo : d.tipo;
      const url = isSaved ? d.url : '#';
      const meta = isSaved ? (d.mime||'') + (d.tamanho_bytes? ' · '+ (d.tamanho_bytes/1024).toFixed(1)+'KB':'') : ((d.file? d.file.name : '') + (d.file? ' · '+(d.file.size/1024).toFixed(1)+'KB':''));
      return `<li style="display:flex; align-items:center; justify-content:space-between; padding:8px; border:1px solid var(--color-gold-light); background:#FFFDF9;">
        <div style="min-width:0; flex:1;">
          <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><span style="background:var(--color-gold-light); padding:2px 6px; font-size:10px; margin-right:6px;">${labelTipo[tipo]||tipo}</span>${title}</div>
          <div style="font-size:11px; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${isSaved? `<a href="${url}" target="_blank" style="color:var(--color-info); text-decoration:underline;">abrir</a> · `:''}${meta} ${isSaved? '': '· pendente (será enviado ao salvar)'}</div>
        </div>
        <button type="button" class="action-btn ${isSaved?'action-btn-danger':''}" data-div-del="${isSaved? d.id : 'pending:'+d._pendingIndex}" style="margin-left:8px;">${isSaved?'Remover':'×'}</button>
      </li>`;
    }).join('');
    docDiversosList.querySelectorAll('[data-div-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const v = btn.getAttribute('data-div-del');
        if(v.startsWith('pending:')){
          const idx = parseInt(v.split(':')[1],10);
          pendingDiversos.splice(idx,1);
          renderDiversosList();
        } else {
          if(!confirm('Remover este arquivo diverso?')) return;
          const { error } = await supabaseClient.from('employee_documents').delete().eq('id', v);
          if(error) alert('Erro: '+error.message); else await fetchDiversos(employeeDiversos[0]? employeeDiversos[0].employee_id : null);
        }
      });
    });
  }

  // 2. Carregar Dados da API
  async function fetchEmployees() {
    try {
      const { data, error } = await supabaseClient
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      employees = data || [];
      render();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <p class="empty-state-title">Erro ao carregar colaboradores</p>
            <p style="font-size: 13px;">${err.message || 'Verifique a conexão com o servidor.'}</p>
          </td>
        </tr>
      `;
    }
  }

  // 3. Renderização Geral
  function render() {
    const query = searchInput.value.toLowerCase().trim();
    const statusVal = filterStatus.value;
    const vinculoVal = filterVinculo.value;

    const filtered = employees.filter(emp => {
      const digitsQuery = query.replace(/\D+/g, '');
      const cpfDigits = (emp.cpf || '').replace(/\D+/g, '');
      const matchQuery = !query ||
        (emp.name && emp.name.toLowerCase().includes(query)) ||
        (digitsQuery && cpfDigits.includes(digitsQuery)) ||
        (emp.cargo && emp.cargo.toLowerCase().includes(query)) ||
        (emp.setor && emp.setor.toLowerCase().includes(query));

      const matchStatus = !statusVal || (emp.status === statusVal);
      const matchVinculo = !vinculoVal || (emp.vinculo === vinculoVal);

      return matchQuery && matchStatus && matchVinculo;
    });

    renderStats();
    renderTable(filtered);
    renderSidebarDetail();
  }

  // 4. Renderização das Estatísticas (Métricas)
  function renderStats() {
    const total = employees.length;
    const ativos = employees.filter(e => (e.vinculo || 'Ativo') === 'Ativo').length;
    const pendentes = employees.filter(e => e.status === 'Pendente de Documentos').length;
    const aprovados = employees.filter(e => e.status === 'Aprovado pelo RH' || e.status === 'Enviado para Contabilidade').length;

    statTotal.textContent = total;
    statAtivos.textContent = ativos;
    statPendentes.textContent = pendentes;
    statAprovados.textContent = aprovados;
    // GSAP: contador animado (se permitido)
    if (window.BiofirmAnimations && !window.BiofirmAnimations.prefersReducedMotion()) {
      // adia 1 frame para DOM pintar antes de animar
      requestAnimationFrame(function(){ window.BiofirmAnimations.animateStatCount(); });
    }
  }

  // 5. Renderização da Tabela
  function renderTable(list) {
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <p class="empty-state-title">Nenhum colaborador encontrado</p>
            <p style="font-size: 13px;">Clique em "+ Novo Funcionário" para realizar o primeiro cadastro.</p>
          </td>
        </tr>
      `;
      return;
    }

    list.forEach(emp => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';

      // Tratamento de classes de status
      let statusClass = 'status-sem-dados';
      if (emp.status === 'Pendente de Documentos') statusClass = 'status-pendente';
      else if (emp.status === 'Aprovado pelo RH') statusClass = 'status-aprovado';
      else if (emp.status === 'Enviado para Contabilidade') statusClass = 'status-enviado';

      // Tratamento de classes de vínculo
      const vinculo = emp.vinculo || 'Ativo';
      let vinculoClass = 'vinculo-ativo';
      if (vinculo === 'Inativo') vinculoClass = 'vinculo-inativo';
      else if (vinculo === 'Demitido') vinculoClass = 'vinculo-demitido';

      const fotoThumb = emp.foto_url ? `<img src="${emp.foto_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--color-gold-light);margin-right:8px;vertical-align:middle;">` : '';
      tr.innerHTML = `
        <td>
          <div class="employee-name" style="display:flex;align-items:center;">${fotoThumb}${emp.name}</div>
        </td>
        <td class="mono">${formatCPF(emp.cpf)}</td>
        <td>
          <div style="font-weight: 500;">${emp.cargo || '-'}</div>
          <div class="employee-role-dept">${emp.setor || '-'}${emp.salario!=null? ' · '+formatMoneyBRL(emp.salario):''}</div>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${emp.status || 'Sem dados'}</span>
        </td>
        <td>
          <span class="vinculo-badge ${vinculoClass}">${vinculo}</span>
        </td>
        <td class="actions">
          <button class="action-btn" data-action="view" data-id="${emp.id}" title="Ver Ficha">Ver</button>
          <button class="action-btn" data-action="edit" data-id="${emp.id}" title="Editar Dados">Editar</button>
          <button class="action-btn action-btn-danger" data-action="delete" data-id="${emp.id}" title="Excluir">Excluir</button>
        </td>
      `;

      // Botões Ver/Editar/Excluir — listener direto (garante funcionamento mesmo com stopPropagation)
      tr.querySelectorAll('button[data-action]').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          const empItem = employees.find(item => item.id == id);
          if(!empItem) return;
          if(action==='view') window.viewEmployeeDetail(id);
          else if(action==='edit') openEditModal(empItem);
          else if(action==='delete'){
            if(confirm(`Deseja realmente excluir o cadastro de ${empItem.name}?`)){
              try{
                const { error } = await supabaseClient.from('employees').delete().eq('id', id);
                if(error) throw error;
                if(selectedEmployeeId == id) selectedEmployeeId=null;
                await fetchEmployees();
              }catch(err){ alert('Erro ao excluir: '+err.message); }
            }
          }
        });
      });
      // Clique na linha seleciona o colaborador no painel lateral
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button[data-action]')) return;
        selectedEmployeeId = emp.id;
        if (window.BiofirmAnimations) window.BiofirmAnimations.animateRowSelection(tr);
        renderTable(list);
        renderSidebarDetail();
      });

      // Aplicar classe visual de selecionado
      if (emp.id == selectedEmployeeId) {
        tr.classList.add('selected-row');
      }

      tbody.appendChild(tr);
    });

    // Se houver itens e nenhum estiver selecionado, seleciona o primeiro
    if (list.length > 0 && (!selectedEmployeeId || !employees.find(e => e.id == selectedEmployeeId))) {
      selectedEmployeeId = list[0].id;
      renderSidebarDetail();
    }

    // GSAP: stagger de entrada das linhas
    if (window.BiofirmAnimations) window.BiofirmAnimations.animateTableRows();
  }

  // 6. Renderização da Ficha Lateral (1/3)
  function renderSidebarDetail() {
    if (!selectedEmployeeId) {
      detailContent.innerHTML = `
        <p class="empty-state-text" style="font-size: 13px; color: var(--color-text-muted); text-align: center;">
          Selecione um funcionário na tabela para visualizar a ficha rápida.
        </p>
      `;
      return;
    }
    var isSwitching = detailContent.dataset.lastId && detailContent.dataset.lastId != String(selectedEmployeeId);

    const emp = employees.find(e => e.id == selectedEmployeeId);
    if (!emp) return;

    const initial = emp.name ? emp.name.charAt(0).toUpperCase() : 'B';
    const vinculo = emp.vinculo || 'Ativo';
    let vinculoClass = 'vinculo-ativo';
    if (vinculo === 'Inativo') vinculoClass = 'vinculo-inativo';
    else if (vinculo === 'Demitido') vinculoClass = 'vinculo-demitido';

    const fotoHtml = emp.foto_url ? `<img src="${emp.foto_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1px solid var(--color-gold);">` : `<div class="detail-avatar">${initial}</div>`;
    const docsCount = [emp.rg_frente_url, emp.rg_verso_url, emp.cpf_doc_url, emp.comprovante_endereco_url, emp.ctps_doc_url].filter(Boolean).length;
    const salarioTxt = emp.salario!=null ? formatMoneyBRL(emp.salario) : (emp.cargo_id && positions.find(p=> String(p.id)===String(emp.cargo_id)) ? formatMoneyBRL(positions.find(p=> String(p.id)===String(emp.cargo_id)).salario_base) : '-');
    detailContent.innerHTML = `
      <div class="detail-header">
        ${fotoHtml}
        <div>
          <div class="detail-title">${emp.name}</div>
          <div class="detail-subtitle">${emp.cargo || 'Cargo não informado'} · <span style="color:var(--color-success); font-weight:600;">${salarioTxt}</span></div>
          <div style="font-size:11px; color:var(--color-text-muted);">${docsCount}/5 docs · CTPS: ${emp.ctps_numero||'-'} · PIS: ${emp.pis_pasep? (window.BiofirmMasks? window.BiofirmMasks.MASKS.pis(emp.pis_pasep): emp.pis_pasep) : '-'}</div>
        </div>
      </div>
      <div class="detail-list">
        <div class="detail-row">
          <span class="detail-row-label">CPF:</span>
          <span class="detail-row-value mono">${formatCPF(emp.cpf)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">RG:</span>
          <span class="detail-row-value mono">${formatRG(emp.rg) || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Setor:</span>
          <span class="detail-row-value">${emp.setor || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Endereço:</span>
          <span class="detail-row-value">${formatAddress(emp) || '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Documentos:</span>
          <span class="detail-row-value" style="font-size:11px;">${docsCount===5?'✅ Completo': docsCount+'/5'} ${emp.rg_frente_url?'· RG frente':''} ${emp.rg_verso_url?'· verso':''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Vínculo:</span>
          <span class="vinculo-badge ${vinculoClass}">${vinculo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Status Fluxo:</span>
          <span class="detail-row-value">${emp.status || 'Sem dados'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Data de Registro:</span>
          <span class="detail-row-value mono">${emp.created_at ? new Date(emp.created_at).toLocaleDateString('pt-BR') : '-'}</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 6px;">
        <button class="btn-secondary btn-small" style="flex: 1;" onclick="window.viewEmployeeDetail(${emp.id})">Visualizar Ficha</button>
        <button class="btn-primary btn-small" style="flex: 1;" onclick="window.editEmployeeModal(${emp.id})">Editar</button>
      </div>
    `;
    detailContent.dataset.lastId = String(emp.id);
    if (isSwitching && window.BiofirmAnimations) window.BiofirmAnimations.animateDetailSwitch();
    else if (!isSwitching && window.BiofirmAnimations && !detailContent.dataset.animatedOnce) {
      detailContent.dataset.animatedOnce = '1';
      window.BiofirmAnimations.animateDetailSwitch();
    }
  }

  // 7. Eventos de Busca e Filtros
  searchInput.addEventListener('input', render);
  filterStatus.addEventListener('change', render);
  filterVinculo.addEventListener('change', render);

  // 8. Modais e Formulário — com GSAP
  function openCreateModal() {
    modalFormTitle.textContent = 'Novo Colaborador';
    empIdInput.value = '';
    employeeForm.reset();
    empVinculoInput.value = 'Ativo';
    empStatusInput.value = 'Sem dados';
    if(empCargoInput) empCargoInput.value='';
    if(empSalarioInput) empSalarioInput.value='';
    if(cargoSalarioInfo) cargoSalarioInfo.textContent='Salário fixo definido no cargo — herdado automaticamente';
    if(empSetorInput) empSetorInput.value='';
    pendingDiversos = []; employeeDiversos = []; renderDiversosList();
    if(divDocInfo) divDocInfo.textContent='';
    clearAddress();
    clearDocsPreview();
    if (fotoPreviewWrap) fotoPreviewWrap.style.backgroundImage = '';
    if (fotoInfo) fotoInfo.textContent = 'JPG/PNG/WebP até 10MB — será comprimida automaticamente';
    if (window.BiofirmAnimations) window.BiofirmAnimations.openModalAnimated(employeeModal);
    else employeeModal.classList.add('active');
  }

  function openEditModal(emp) {
    modalFormTitle.textContent = 'Editar Colaborador';
    empIdInput.value = emp.id;
    empNameInput.value = emp.name || '';
    empCpfInput.value = emp.cpf || '';
    empRgInput.value = emp.rg || '';
    if (empCtpsNumeroInput) empCtpsNumeroInput.value = emp.ctps_numero || '';
    if (empPisInput) empPisInput.value = emp.pis_pasep || '';
    if (empCargoInput) {
      // prioriza cargo_id, fallback texto legado
      if(emp.cargo_id) empCargoInput.value = String(emp.cargo_id);
      else {
        const found = positions.find(p=> p.nome===emp.cargo);
        empCargoInput.value = found ? String(found.id) : '';
      }
      syncSalarioFromCargo();
      // se trigger ainda não herdou salário, mostra valor do cargo base
      if(emp.salario!=null && empSalarioInput) empSalarioInput.value = formatMoneyBRL(emp.salario);
    }
    if (empSetorInput) empSetorInput.value = emp.setor || '';
    empVinculoInput.value = emp.vinculo || 'Ativo';
    empStatusInput.value = emp.status || 'Sem dados';
    empCepInput.value = emp.cep || '';
    empLogradouroInput.value = emp.logradouro || '';
    empNumeroInput.value = emp.numero || '';
    empComplementoInput.value = emp.complemento || '';
    empBairroInput.value = emp.bairro || '';
    empCidadeInput.value = emp.cidade || '';
    empUfInput.value = emp.uf || '';
    enableAddressFields(!!emp.cep);
    // Foto e docs existentes
    if (empFotoUrlInput) empFotoUrlInput.value = emp.foto_url || '';
    if (fotoPreviewWrap) {
      fotoPreviewWrap.style.backgroundImage = emp.foto_url ? `url(${emp.foto_url})` : '';
      fotoPreviewWrap.style.backgroundSize = 'cover';
    }
    if (empRgFrenteUrlInput) empRgFrenteUrlInput.value = emp.rg_frente_url || '';
    if (empRgVersoUrlInput) empRgVersoUrlInput.value = emp.rg_verso_url || '';
    if (empCpfDocUrlInput) empCpfDocUrlInput.value = emp.cpf_doc_url || '';
    if (empCompEndUrlInput) empCompEndUrlInput.value = emp.comprovante_endereco_url || '';
    if (empCtpsDocUrlInput) empCtpsDocUrlInput.value = emp.ctps_doc_url || '';
    renderDocLink('infoRgFrente', emp.rg_frente_url);
    renderDocLink('infoRgVerso', emp.rg_verso_url);
    renderDocLink('infoCpfDoc', emp.cpf_doc_url);
    renderDocLink('infoCompEnd', emp.comprovante_endereco_url);
    renderDocLink('infoCtpsDoc', emp.ctps_doc_url);
    pendingDiversos = []; fetchDiversos(emp.id);
    if(divDocInfo) divDocInfo.textContent='';
    if(divDocFileInput) divDocFileInput.value='';
    if(divDocTituloInput) divDocTituloInput.value='';
    if (window.BiofirmAnimations) window.BiofirmAnimations.openModalAnimated(employeeModal);
    else employeeModal.classList.add('active');
  }

  function clearDocsPreview() {
    ['empRgFrenteUrl','empRgVersoUrl','empCpfDocUrl','empCompEndUrl','empCtpsDocUrl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['infoRgFrente','infoRgVerso','infoCpfDoc','infoCompEnd','infoCtpsDoc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    ['previewRgFrente','previewRgVerso','previewCpfDoc','previewCompEnd','previewCtpsDoc'].forEach(id => {
      const wrap = document.getElementById(id);
      if (wrap) { wrap.style.display='none'; const img=wrap.querySelector('img'); if(img) img.src=''; }
    });
    if (empFotoUrlInput) empFotoUrlInput.value='';
  }
  function renderDocLink(infoId, url){
    const el=document.getElementById(infoId);
    if(!el) return;
    if(url) el.innerHTML = `<a href="${url}" target="_blank" style="color:var(--color-info);">Arquivo atual — abrir</a>`;
    else el.textContent='';
  }

   function clearAddress() {
     const cep = document.getElementById('empCep');
     const logradouro = document.getElementById('empLogradouro');
     const numero = document.getElementById('empNumero');
     const complemento = document.getElementById('empComplemento');
     const bairro = document.getElementById('empBairro');
     const cidade = document.getElementById('empCidade');
     const uf = document.getElementById('empUf');

     if (cep) {
       cep.value = '';
     }
     if (logradouro) {
       logradouro.value = '';
       logradouro.disabled = true;
     }
     if (numero) {
       numero.value = '';
     }
     if (complemento) {
       complemento.value = '';
     }
     if (bairro) {
       bairro.value = '';
       bairro.disabled = true;
     }
     if (cidade) {
       cidade.value = '';
       cidade.disabled = true;
     }
     if (uf) {
       uf.value = '';
       uf.disabled = true;
     }
   }

   function enableAddressFields(disable) {
     const logradouro = document.getElementById('empLogradouro');
     const numero = document.getElementById('empNumero');
     const complemento = document.getElementById('empComplemento');
     const bairro = document.getElementById('empBairro');
     const cidade = document.getElementById('empCidade');
     const uf = document.getElementById('empUf');

     if (logradouro) logradouro.disabled = disable;
     if (numero) numero.disabled = disable;
     if (complemento) complemento.disabled = disable;
     if (bairro) bairro.disabled = disable;
     if (cidade) cidade.disabled = disable;
     if (uf) uf.disabled = disable;
   }

      function closeModal() {
        function doReset(){
          employeeForm.reset();
          clearAddress();
          clearDocsPreview();
          pendingDiversos=[]; employeeDiversos=[]; renderDiversosList(); if(divDocInfo) divDocInfo.textContent=''; if(divDocFileInput) divDocFileInput.value=''; if(divDocTituloInput) divDocTituloInput.value='';
          if(empSalarioInput) empSalarioInput.value=''; if(cargoSalarioInfo) cargoSalarioInfo.textContent='Salário fixo definido no cargo — herdado automaticamente';
          if(fotoPreviewWrap) fotoPreviewWrap.style.backgroundImage='';
          [empFotoInput, empRgFrenteInput, empRgVersoInput, empCpfDocInput, empCompEndInput, empCtpsDocInput].forEach(inp=>{ if(inp){ inp.value=''; delete inp._compressedFile; }});
        }
       if (window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(employeeModal, doReset);
       else { employeeModal.classList.remove('active'); doReset(); }
     }

   function validateCPF(cpf) {
     const d = (cpf || '').replace(/\D+/g, '');
     if (d.length !== 11) return false;
     if (/^(\d)\1+$/.test(d)) return false;
     let sum = 0;
     for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
     let mod = (sum * 10) % 11;
     if (mod === 10) mod = 0;
     if (mod !== parseInt(d[9])) return false;
     sum = 0;
     for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
     mod = (sum * 10) % 11;
     if (mod === 10) mod = 0;
     return mod === parseInt(d[10]);
   }

   function validateRG(rg) {
      const d = (rg || '').replace(/\D+/g, '');
      return d.length >= 7 && d.length <= 13;
    }

    function showFieldError(input, msg) {
      removeFieldError(input);
      if (!input) return;
      const err = document.createElement('span');
      err.className = 'field-error';
      err.textContent = msg;
      err.style.cssText = 'color: var(--color-danger); font-size: 11px; display: block; margin-top: 2px;';
      input.parentNode.appendChild(err);
      input.style.borderColor = 'var(--color-danger)';
      if (window.BiofirmAnimations && !window.BiofirmAnimations.prefersReducedMotion() && typeof gsap !== 'undefined') {
        gsap.killTweensOf(input);
        gsap.timeline().to(input, { x: -5, duration: 0.06 }).to(input, { x: 5, duration: 0.06 }).to(input, { x: -3, duration: 0.06 }).to(input, { x: 0, duration: 0.08 });
        gsap.from(err, { y: -4, autoAlpha: 0, duration: 0.2, ease: 'power2.out' });
      }
    }

   function removeFieldError(input) {
     if (!input) return;
     const err = input.parentNode.querySelector('.field-error');
     if (err) err.remove();
     input.style.borderColor = '';
   }

   async function searchCEP() {
     const raw = empCepInput ? empCepInput.value : '';
     const cep = (raw || '').replace(/\D+/g, '');
     if (cep.length !== 8) return;
     try {
       const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
       if (!res.ok) throw new Error();
       const data = await res.json();
       if (data.erro) {
         if (empLogradouroInput) empLogradouroInput.value = '';
         if (empBairroInput) empBairroInput.value = '';
         if (empCidadeInput) empCidadeInput.value = '';
         if (empUfInput) empUfInput.value = '';
         alert('CEP não encontrado.');
         return;
       }
       if (empLogradouroInput) {
         empLogradouroInput.value = data.logradouro || '';
         empLogradouroInput.disabled = false;
       }
       if (empBairroInput) {
         empBairroInput.value = data.bairro || '';
         empBairroInput.disabled = false;
       }
       if (empCidadeInput) {
         empCidadeInput.value = data.localidade || '';
         empCidadeInput.disabled = false;
       }
       if (empUfInput) {
         empUfInput.value = data.uf || '';
         empUfInput.disabled = false;
       }
     } catch {
       alert('Erro ao buscar CEP. Verifique sua conexão.');
     }
   }

   btnOpenModal.addEventListener('click', openCreateModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  if (empCepInput) {
    empCepInput.addEventListener('blur', searchCEP);
    if (window.BiofirmMasks) window.BiofirmMasks.bind(empCepInput, 'cep');
  }
  if (empRgInput) {
    if (window.BiofirmMasks) window.BiofirmMasks.bind(empRgInput, 'rg');
  }
  if (empCtpsNumeroInput && window.BiofirmMasks) window.BiofirmMasks.bind(empCtpsNumeroInput, 'ctps');
  if (empPisInput && window.BiofirmMasks) window.BiofirmMasks.bind(empPisInput, 'pis');
  if (empSalarioInput && window.BiofirmMasks) window.BiofirmMasks.bind(empSalarioInput, 'money');
  if (empCargoInput) empCargoInput.addEventListener('change', syncSalarioFromCargo);
  // Cargos modal
  const cargoModal = document.getElementById('cargoModal');
  const btnManageCargos = document.getElementById('btnManageCargos');
  const navCargos = document.getElementById('navCargos');
  const btnCloseCargoModal = document.getElementById('btnCloseCargoModal');
  const btnCloseCargoBtn = document.getElementById('btnCloseCargoBtn');
  const btnSaveCargo = document.getElementById('btnSaveCargo');
  function openCargoModal(){ if(window.BiofirmAnimations) window.BiofirmAnimations.openModalAnimated(cargoModal); else cargoModal.classList.add('active'); renderCargoList(); }
  function closeCargoModal(){ if(window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(cargoModal); else cargoModal.classList.remove('active'); const n=document.getElementById('cargoNome'); if(n) n.value=''; const s=document.getElementById('cargoSetor'); if(s) s.value=''; const sal=document.getElementById('cargoSalario'); if(sal){ sal.value=''; delete sal.dataset.editId; } }
  if(btnManageCargos) btnManageCargos.addEventListener('click', openCargoModal);
  if(navCargos) navCargos.addEventListener('click', function(e){ e.preventDefault(); openCargoModal(); });
  if(btnCloseCargoModal) btnCloseCargoModal.addEventListener('click', closeCargoModal);
  if(btnCloseCargoBtn) btnCloseCargoBtn.addEventListener('click', closeCargoModal);
  if(cargoModal) cargoModal.addEventListener('click', function(e){ if(e.target===cargoModal) closeCargoModal(); });
  if(btnSaveCargo) btnSaveCargo.addEventListener('click', async function(){
    const nomeEl=document.getElementById('cargoNome');
    const setorEl=document.getElementById('cargoSetor');
    const salEl=document.getElementById('cargoSalario');
    const nome=(nomeEl?nomeEl.value:'').trim();
    const setor=(setorEl?setorEl.value:'').trim();
    const salarioVal=parseMoneyBRL(salEl? salEl.value : '');
    if(!nome){ alert('Informe o nome do cargo.'); return; }
    if(salarioVal==null || salarioVal<0){ alert('Informe salário válido (R$).'); return; }
    const editId = salEl && salEl.dataset.editId ? salEl.dataset.editId : null;
    try{
      if(editId){
        const { error } = await supabaseClient.from('positions').update({ nome, setor: setor||null, salario_base: salarioVal }).eq('id', editId);
        if(error) throw error;
      } else {
        const { error } = await supabaseClient.from('positions').insert({ nome, setor: setor||null, salario_base: salarioVal });
        if(error) throw error;
      }
      if(nomeEl) nomeEl.value=''; if(setorEl) setorEl.value=''; if(salEl){ salEl.value=''; delete salEl.dataset.editId; }
      await fetchPositions();
    }catch(err){ alert('Erro ao salvar cargo: '+err.message); }
  });
  if(document.getElementById('cargoSalario') && window.BiofirmMasks) window.BiofirmMasks.bind(document.getElementById('cargoSalario'),'money');
  // Arquivos diversos — adicionar à lista
  if(btnAddDiverso) btnAddDiverso.addEventListener('click', async function(){
    const tipo = divDocTipoInput ? divDocTipoInput.value : 'outro';
    const titulo = divDocTituloInput ? divDocTituloInput.value.trim() : '';
    const file = divDocFileInput && divDocFileInput.files[0] ? divDocFileInput.files[0] : null;
    if(!titulo){ alert('Informe o título/descrição do arquivo.'); return; }
    if(!file){ alert('Selecione o arquivo.'); return; }
    if(file.size > 10*1024*1024){ alert('Arquivo excede 10MB.'); return; }
    const empId = empIdInput && empIdInput.value ? empIdInput.value : null;
    // se funcionário já salvo (edição), envia imediatamente
    if(empId){
      try{
        if(divDocInfo) divDocInfo.textContent='Enviando...';
        let toUpload = file;
        if(window.BiofirmCompress && file.type.startsWith('image/')){
          try{ toUpload = await window.BiofirmCompress.compressImage(file, { maxWidth:1280, quality:0.72 }); }catch(e){ toUpload=file; }
        }
        const url = await uploadFile(toUpload, 'diversos', empId);
        const { error } = await supabaseClient.from('employee_documents').insert({ employee_id: Number(empId), tipo, titulo, url, mime: toUpload.type, tamanho_bytes: toUpload.size });
        if(error) throw error;
        if(divDocFileInput) divDocFileInput.value='';
        if(divDocTituloInput) divDocTituloInput.value='';
        if(divDocInfo) divDocInfo.textContent='Arquivo enviado com sucesso.';
        await fetchDiversos(empId);
      }catch(err){ if(divDocInfo) divDocInfo.textContent='Erro: '+err.message; alert('Erro ao enviar: '+err.message); }
    } else {
      // modo criação — fila pendente, será enviado após criar funcionário
      let compressed = file;
      if(window.BiofirmCompress && file.type.startsWith('image/')){
        try{ compressed = await window.BiofirmCompress.compressImage(file, { maxWidth:1280, quality:0.72 }); }catch(e){ compressed=file; }
      }
      pendingDiversos.push({ tipo, titulo, file: compressed, origName: file.name });
      if(divDocFileInput) divDocFileInput.value='';
      if(divDocTituloInput) divDocTituloInput.value='';
      if(divDocInfo) divDocInfo.textContent='Adicionado à fila — será enviado ao salvar o funcionário.';
      renderDiversosList();
    }
  });

  // Upload helpers com compressão (economia 1GB)
  const BUCKET = 'employee-docs';
  async function ensureBucket(){ /* bucket criado via SQL, ignora erro */ }
  async function uploadFile(file, folder, empIdHint){
    if(!file) return null;
    let toUpload = file;
    if(window.BiofirmCompress && file.type.startsWith('image/')){
      try { toUpload = await window.BiofirmCompress.compressImage(file, { maxWidth: 1280, quality: 0.72 }); } catch(e){ toUpload=file; }
    }
    if(toUpload.size > 10*1024*1024){ throw new Error('Arquivo excede 10MB: '+file.name); }
    const ext = toUpload.name.split('.').pop() || 'bin';
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi,'');
    const key = `${safeFolder}/${empIdHint||'tmp'}_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
    const { error } = await supabaseClient.storage.from(BUCKET).upload(key, toUpload, { cacheControl:'3600', upsert:false, contentType: toUpload.type });
    if(error) throw error;
    const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(key);
    return data.publicUrl;
  }
  function bindDocInput(fileInput, urlInput, infoId, previewId){
    if(!fileInput) return;
    fileInput.addEventListener('change', async function(){
      const file = fileInput.files[0];
      if(!file) return;
      const infoEl = document.getElementById(infoId);
      const previewWrap = document.getElementById(previewId);
      const previewImg = previewWrap ? previewWrap.querySelector('img') : null;
      try{
        if(infoEl) infoEl.textContent = 'Comprimindo...';
        let displayFile = file;
        if(window.BiofirmCompress && file.type.startsWith('image/')){
          displayFile = await window.BiofirmCompress.compressAndPreview(file, previewImg, infoEl, {maxWidth:1280, quality:0.72});
          if(previewWrap) previewWrap.style.display='block';
        } else {
          if(infoEl) infoEl.textContent = window.BiofirmCompress ? window.BiofirmCompress.formatBytes(file.size) + ' (PDF)' : file.name;
          if(previewWrap) previewWrap.style.display='none';
        }
        // guarda File para upload no submit (via dataset)
        fileInput._compressedFile = displayFile;
      }catch(err){ if(infoEl) infoEl.textContent='Erro: '+err.message; }
    });
  }
  // Foto perfil — modal escolha Upload vs Câmera
  const fotoChoiceModal = document.getElementById('fotoChoiceModal');
  const btnFotoChoice = document.getElementById('btnFotoChoice');
  const btnCloseFotoChoice = document.getElementById('btnCloseFotoChoice');
  const btnFotoUpload = document.getElementById('btnFotoUpload');
  const btnFotoCamera = document.getElementById('btnFotoCamera');
  const fotoChoiceOptions = document.getElementById('fotoChoiceOptions');
  const fotoCameraArea = document.getElementById('fotoCameraArea');
  const fotoVideo = document.getElementById('fotoVideo');
  const fotoCanvas = document.getElementById('fotoCanvas');
  const btnFotoBack = document.getElementById('btnFotoBack');
  const btnFotoCapture = document.getElementById('btnFotoCapture');
  const fotoCapturePreview = document.getElementById('fotoCapturePreview');
  const fotoCaptureImg = document.getElementById('fotoCaptureImg');
  const btnFotoRetake = document.getElementById('btnFotoRetake');
  const btnFotoConfirm = document.getElementById('btnFotoConfirm');
  let fotoStream = null;
  let capturedFile = null;

  async function setFotoFile(file){
    if(!file) return;
    try{
      if(fotoInfo) fotoInfo.textContent='Comprimindo...';
      const compressed = await window.BiofirmCompress.compressAndPreview(file, null, fotoInfo, {maxWidth:800, quality:0.72, maxSizeMB:0.5});
      empFotoInput._compressedFile = compressed;
      // também mantém FileList para compatibilidade submit
      const dt = new DataTransfer(); dt.items.add(compressed); empFotoInput.files = dt.files;
      const url = URL.createObjectURL(compressed);
      if(fotoPreviewWrap){ fotoPreviewWrap.style.backgroundImage=`url(${url})`; fotoPreviewWrap.style.backgroundSize='cover'; if(window.BiofirmAnimations) window.BiofirmAnimations.popFotoPreview(); }
    }catch(e){ if(fotoInfo) fotoInfo.textContent='Erro: '+e.message; }
  }
  if(empFotoInput){
    empFotoInput.addEventListener('change', async function(){
      const f=empFotoInput.files[0]; if(!f) return;
      await setFotoFile(f);
      closeFotoChoice();
    });
  }
  function openFotoChoice(){
    if(!fotoChoiceModal) return;
    // reset estados
    if(fotoChoiceOptions) fotoChoiceOptions.style.display='flex';
    if(fotoCameraArea) fotoCameraArea.style.display='none';
    if(fotoCapturePreview) fotoCapturePreview.style.display='none';
    if(fotoVideo) fotoVideo.style.display='block';
    if(btnFotoCapture) btnFotoCapture.style.display='block';
    stopCamera();
    if (window.BiofirmAnimations) window.BiofirmAnimations.openModalAnimated(fotoChoiceModal);
    else fotoChoiceModal.classList.add('active');
  }
  function closeFotoChoice(){
    if (window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(fotoChoiceModal, function(){ stopCamera(); });
    else { if(fotoChoiceModal) fotoChoiceModal.classList.remove('active'); stopCamera(); }
  }
  async function startCamera(){
    try{
      fotoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:{ideal:1280}, height:{ideal:720} }, audio:false });
      if(fotoVideo){ fotoVideo.srcObject = fotoStream; await fotoVideo.play(); }
      if(fotoChoiceOptions) fotoChoiceOptions.style.display='none';
      if(fotoCameraArea) fotoCameraArea.style.display='flex';
      if(fotoCapturePreview) fotoCapturePreview.style.display='none';
      if(btnFotoCapture) btnFotoCapture.style.display='block';
      if(fotoVideo) fotoVideo.style.display='block';
    }catch(err){
      alert('Não foi possível abrir a câmera: ' + err.message + '\nVerifique permissão do navegador.');
    }
  }
  function stopCamera(){
    if(fotoStream){ fotoStream.getTracks().forEach(t=>t.stop()); fotoStream=null; }
    if(fotoVideo) fotoVideo.srcObject=null;
  }
  if(btnFotoChoice) btnFotoChoice.addEventListener('click', openFotoChoice);
  if(fotoPreviewWrap) fotoPreviewWrap.addEventListener('click', openFotoChoice);
  if(btnCloseFotoChoice) btnCloseFotoChoice.addEventListener('click', closeFotoChoice);
  if(btnFotoUpload) btnFotoUpload.addEventListener('click', ()=> empFotoInput && empFotoInput.click());
  if(btnFotoCamera) btnFotoCamera.addEventListener('click', startCamera);
  if(btnFotoBack) btnFotoBack.addEventListener('click', ()=>{ stopCamera(); if(fotoChoiceOptions) fotoChoiceOptions.style.display='flex'; if(fotoCameraArea) fotoCameraArea.style.display='none'; });
  // (fechamento por clique no backdrop tratado no listener global window com GSAP)
  if(btnFotoCapture) btnFotoCapture.addEventListener('click', ()=>{
    if(!fotoVideo || !fotoCanvas || !fotoVideo.videoWidth) return;
    const w = fotoVideo.videoWidth, h = fotoVideo.videoHeight;
    fotoCanvas.width = w; fotoCanvas.height = h;
    const ctx = fotoCanvas.getContext('2d');
    ctx.drawImage(fotoVideo, 0, 0, w, h);
    fotoCanvas.toBlob(async (blob)=>{
      if(!blob) return;
      capturedFile = new File([blob], `camera_${Date.now()}.jpg`, { type:'image/jpeg' });
      const url = URL.createObjectURL(blob);
      if(fotoCaptureImg) fotoCaptureImg.src = url;
      if(fotoCapturePreview) fotoCapturePreview.style.display='block';
      if(fotoVideo) fotoVideo.style.display='none';
      if(btnFotoCapture) btnFotoCapture.style.display='none';
      stopCamera();
    }, 'image/jpeg', 0.92);
  });
  if(btnFotoRetake) btnFotoRetake.addEventListener('click', async ()=>{
    if(fotoCapturePreview) fotoCapturePreview.style.display='none';
    await startCamera();
  });
  if(btnFotoConfirm) btnFotoConfirm.addEventListener('click', async ()=>{
    if(capturedFile) await setFotoFile(capturedFile);
    closeFotoChoice();
  });
  bindDocInput(empRgFrenteInput, empRgFrenteUrlInput, 'infoRgFrente', 'previewRgFrente');
  bindDocInput(empRgVersoInput, empRgVersoUrlInput, 'infoRgVerso', 'previewRgVerso');
  bindDocInput(empCpfDocInput, empCpfDocUrlInput, 'infoCpfDoc', 'previewCpfDoc');
  bindDocInput(empCompEndInput, empCompEndUrlInput, 'infoCompEnd', 'previewCompEnd');
  bindDocInput(empCtpsDocInput, empCtpsDocUrlInput, 'infoCtpsDoc', 'previewCtpsDoc');

  function clearAllErrors() {
    [empNameInput, empCpfInput, empRgInput, empCtpsNumeroInput, empPisInput, empCargoInput, empSetorInput, empSalarioInput, empCepInput, empNumeroInput].forEach(function (input) {
      if (input) removeFieldError(input);
    });
  }

  // Salvar Colaborador (POST ou PUT) — cadastro completo com uploads comprimidos
  employeeForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const id = empIdInput.value;
    // Uploads pendentes (se houver file selecionado, comprime e envia para Storage)
    const btnSave = document.getElementById('btnSaveEmployee');
    const origBtnText = btnSave ? btnSave.textContent : '';
    if(btnSave){ btnSave.disabled=true; btnSave.textContent='Salvando...'; }
    try {
      const hint = id || 'new_'+Date.now();
      // foto
      if(empFotoInput && empFotoInput.files[0]){
        const f = empFotoInput._compressedFile || empFotoInput.files[0];
        const url = await uploadFile(f, 'foto', hint);
        if(url && empFotoUrlInput) empFotoUrlInput.value = url;
      }
      const uploads = [
        [empRgFrenteInput, empRgFrenteUrlInput, 'rg_frente'],
        [empRgVersoInput, empRgVersoUrlInput, 'rg_verso'],
        [empCpfDocInput, empCpfDocUrlInput, 'cpf'],
        [empCompEndInput, empCompEndUrlInput, 'comprovante'],
        [empCtpsDocInput, empCtpsDocUrlInput, 'ctps'],
      ];
      for(const [fin, urlIn, folder] of uploads){
        if(fin && fin.files[0]){
          const f = fin._compressedFile || fin.files[0];
          const url = await uploadFile(f, folder, hint);
          if(url && urlIn) urlIn.value = url;
        }
      }

      const cargoIdVal = empCargoInput && empCargoInput.value ? Number(empCargoInput.value) : null;
      const payload = {
        name: empNameInput.value.trim(),
        cpf: empCpfInput.value.trim(),
        rg: empRgInput ? empRgInput.value.trim() : '',
        ctps_numero: empCtpsNumeroInput ? empCtpsNumeroInput.value.trim() : '',
        pis_pasep: empPisInput ? empPisInput.value.trim() : '',
        cargo_id: cargoIdVal,
        // cargo/setor serão sincronizados pelo trigger sync_salario_from_position, mas enviamos fallback
        setor: empSetorInput.value.trim(),
        vinculo: empVinculoInput.value,
        status: empStatusInput.value,
        cep: empCepInput ? empCepInput.value.trim() : '',
        logradouro: empLogradouroInput ? empLogradouroInput.value.trim() : '',
        numero: empNumeroInput ? empNumeroInput.value.trim() : '',
        complemento: empComplementoInput ? empComplementoInput.value.trim() : '',
        bairro: empBairroInput ? empBairroInput.value.trim() : '',
        cidade: empCidadeInput ? empCidadeInput.value.trim() : '',
        uf: empUfInput ? empUfInput.value : '',
        foto_url: empFotoUrlInput ? empFotoUrlInput.value.trim() : '',
        rg_frente_url: empRgFrenteUrlInput ? empRgFrenteUrlInput.value.trim() : '',
        rg_verso_url: empRgVersoUrlInput ? empRgVersoUrlInput.value.trim() : '',
        cpf_doc_url: empCpfDocUrlInput ? empCpfDocUrlInput.value.trim() : '',
        comprovante_endereco_url: empCompEndUrlInput ? empCompEndUrlInput.value.trim() : '',
        ctps_doc_url: empCtpsDocUrlInput ? empCtpsDocUrlInput.value.trim() : ''
      };
      // se cargo_id presente, não precisa enviar cargo texto (trigger seta), mas mantém compat
      if(cargoIdVal){
        const pos = positions.find(p=> p.id===cargoIdVal);
        if(pos) payload.cargo = pos.nome;
      } else {
        payload.cargo = null;
      }
      // Normaliza vazios para null (evita string vazia no banco)
      Object.keys(payload).forEach(k=>{ if(payload[k]==='') payload[k]=null; });

      clearAllErrors();
      let hasError = false;

      if (!payload.name) {
        showFieldError(empNameInput, 'Nome completo é obrigatório.');
        hasError = true;
      }
      if (!payload.cpf || !validateCPF(payload.cpf)) {
        showFieldError(empCpfInput, 'CPF inválido.');
        hasError = true;
      }
      if (!payload.cargo_id) {
        showFieldError(empCargoInput, 'Selecione o cargo/função.');
        hasError = true;
      }
      if (payload.rg && !validateRG(payload.rg)) {
        showFieldError(empRgInput, 'RG inválido.');
        hasError = true;
      }
      if (hasError) { if(btnSave){ btnSave.disabled=false; btnSave.textContent=origBtnText; } return; }

      let savedId = id ? Number(id) : null;
      if (id) {
        const { error } = await supabaseClient
          .from('employees')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
        savedId = Number(id);
      } else {
        const { data, error } = await supabaseClient
          .from('employees')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        savedId = data ? data.id : null;
      }
      // envia arquivos diversos pendentes (modo criação)
      if(pendingDiversos.length>0 && savedId){
        for(const pd of pendingDiversos){
          try{
            const url = await uploadFile(pd.file, 'diversos', String(savedId));
            const { error } = await supabaseClient.from('employee_documents').insert({ employee_id: savedId, tipo: pd.tipo, titulo: pd.titulo, url, mime: pd.file.type, tamanho_bytes: pd.file.size });
            if(error) console.error('diversos insert', error);
          }catch(e){ console.error('diversos upload', e); }
        }
        pendingDiversos = [];
      }

      closeModal();
      await fetchEmployees();
      if (savedId) selectedEmployeeId = String(savedId);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      if(btnSave){ btnSave.disabled=false; btnSave.textContent=origBtnText; }
    }
  });

  // 9. Delegar Ações da Tabela
  tbody.addEventListener('click', async function(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const emp = employees.find(item => item.id == id);
    if (!emp) return;

    if (action === 'view') {
      window.viewEmployeeDetail(id);
    } else if (action === 'edit') {
      openEditModal(emp);
    } else if (action === 'delete') {
      if (confirm(`Deseja realmente excluir o cadastro de ${emp.name}?`)) {
        try {
          const { error } = await supabaseClient
            .from('employees')
            .delete()
            .eq('id', id);
          if (error) throw error;
          if (selectedEmployeeId == id) selectedEmployeeId = null;
          await fetchEmployees();
        } catch (err) {
          alert('Erro ao excluir: ' + err.message);
        }
      }
    }
  });

  let viewModalEmployeeId = null;
  // 10. Funções Globais de Visualização / Modal
  window.viewEmployeeDetail = async function(id) {
    viewModalEmployeeId = id;
    const emp = employees.find(e => e.id == id);
    if (!emp) return;

    const viewContent = document.getElementById('viewModalContent');
    const vinculo = emp.vinculo || 'Ativo';
    let vinculoClass = 'vinculo-ativo';
    if (vinculo === 'Inativo') vinculoClass = 'vinculo-inativo';
    else if (vinculo === 'Demitido') vinculoClass = 'vinculo-demitido';

    const addressText = formatAddress(emp) || 'Endereço não cadastrado';
    const fotoView = emp.foto_url ? `<img src="${emp.foto_url}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--color-gold);">` : `<div style="width:64px;height:64px;border-radius:50%;background:#F0E6CE;border:1px solid var(--color-gold);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-style:italic;">${emp.name?emp.name.charAt(0).toUpperCase():'B'}</div>`;
    const docLink = (url,label) => url ? `<a href="${url}" target="_blank" style="color:var(--color-info);text-decoration:underline;">${label} — abrir</a>` : `<span style="color:var(--color-text-muted);">${label} — pendente</span>`;
    const pos = emp.cargo_id ? positions.find(p=> String(p.id)===String(emp.cargo_id)) : null;
    const salarioView = emp.salario!=null ? formatMoneyBRL(emp.salario) : (pos? formatMoneyBRL(pos.salario_base) : '-');
    // busca docs diversos para exibir na ficha
    let diversos = [];
    try{
      const { data } = await supabaseClient.from('employee_documents').select('*').eq('employee_id', emp.id).order('created_at');
      diversos = data || [];
    }catch(e){}
    const diversosHtml = diversos.length ? diversos.map(d=> `<div style="font-size:11px; padding:4px 0; border-bottom:1px solid #F0E6CE;"><span style="background:var(--color-gold-light); padding:1px 5px; font-size:10px;">${d.tipo==='certificado'?'Certificado':d.tipo==='doc_filho'?'Doc. filho':'Outro'}</span> <a href="${d.url}" target="_blank" style="color:var(--color-info); text-decoration:underline;">${d.titulo}</a> <span style="color:var(--color-text-muted);">· ${d.mime||''}</span></div>`).join('') : '<span style="color:var(--color-text-muted); font-size:11px;">Nenhum arquivo diverso.</span>';
    viewContent.innerHTML = `
      <div style="background: #FFFDF9; border: 1px solid var(--color-gold-light); padding: 24px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-gold-light); padding-bottom: 14px; margin-bottom: 16px; gap:12px;">
          <div style="display:flex; gap:14px; align-items:center;">
            ${fotoView}
            <div>
              <h3 style="font-family: var(--font-display); font-size: 20px; font-style: italic; color: var(--color-text);">${emp.name}</h3>
              <p style="font-size: 13px; color: var(--color-text-muted);">${emp.cargo || 'Cargo não especificado'} · ${emp.setor || 'Setor não especificado'} · <span style="color:var(--color-success); font-weight:600;">${salarioView}</span></p>
              <p class="mono" style="font-size:11px; color:var(--color-text-muted);">CTPS: ${emp.ctps_numero || '-'} · PIS: ${emp.pis_pasep || '-'} · Salário fixo do cargo: ${salarioView}</p>
            </div>
          </div>
          <span class="vinculo-badge ${vinculoClass}">${vinculo}</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 13px;">
          <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">CPF:</span>
            <strong class="mono" style="font-size: 14px;">${formatCPF(emp.cpf)}</strong>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">RG:</span>
            <strong class="mono" style="font-size: 14px;">${formatRG(emp.rg) || '-'}</strong>
          </div>
          <div style="grid-column: 1 / -1;">
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">Endereço:</span>
            <strong style="font-size: 14px;">${addressText}</strong>
          </div>
          <div style="grid-column: 1 / -1; background:#FFFCF5; border:1px solid var(--color-gold-light); padding:12px;">
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 8px; font-weight:600;">Documentação anexa:</span>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px;">
              <div>${docLink(emp.rg_frente_url,'RG — Frente')}</div>
              <div>${docLink(emp.rg_verso_url,'RG — Verso')}</div>
              <div>${docLink(emp.cpf_doc_url,'CPF — Cópia')}</div>
              <div>${docLink(emp.comprovante_endereco_url,'Comprovante Endereço')}</div>
              <div style="grid-column:1/-1;">${docLink(emp.ctps_doc_url,'Carteira de Trabalho — Cópia')}</div>
            </div>
          </div>
           <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">Salário (fixo do cargo):</span>
            <strong style="color:var(--color-success);">${salarioView}</strong>
          </div>
          <div style="grid-column:1/-1; background:#FFFCF5; border:1px solid var(--color-gold-light); padding:12px;">
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 8px; font-weight:600;">Arquivos diversos — Certificados / Docs filhos:</span>
            <div>${diversosHtml}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">Status no Fluxo:</span>
            <strong>${emp.status || 'Sem dados'}</strong>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">Vínculo:</span>
            <span class="vinculo-badge ${vinculoClass}">${vinculo}</span>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">Data de Cadastro:</span>
            <span class="mono">${emp.created_at ? new Date(emp.created_at).toLocaleString('pt-BR') : '-'}</span>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block; margin-bottom: 2px;">Última Atualização:</span>
            <span class="mono">${emp.updated_at ? new Date(emp.updated_at).toLocaleString('pt-BR') : '-'}</span>
          </div>
        </div>
      </div>
    `;
    if (window.BiofirmAnimations) window.BiofirmAnimations.openModalAnimated(viewModal);
    else viewModal.classList.add('active');
  };

  window.editEmployeeModal = function(id) {
    const emp = employees.find(e => e.id == id);
    if (emp) openEditModal(emp);
  };


  async function getImageDataUrl(url){
    try{
      const res = await fetch(url, { mode:'cors' });
      if(!res.ok) throw new Error('fetch '+res.status);
      const blob = await res.blob();
      return await new Promise((resolve,reject)=>{
        const fr = new FileReader();
        fr.onload = ()=> resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    }catch(e){ return null; }
  }

  async function exportFichaPDF(){
    const emp = employees.find(e => e.id == viewModalEmployeeId) || employees.find(e=>e.id==selectedEmployeeId);
    if(!emp){ alert('Selecione um colaborador.'); return; }
    const { jsPDF } = window.jspdf;
    if(!jsPDF){ alert('jsPDF não carregado. Verifique conexão.'); return; }
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;

    // Header dourado
    doc.setFillColor(184,148,60); doc.rect(0,0,pageW,12,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(255,255,255);
    doc.text('Biofirm', margin, 8);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.text('FICHA CADASTRAL DO COLABORADOR', pageW - margin, 8, { align:'right' });
    y = 18;
    // Título + foto
    doc.setTextColor(46,42,36);
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text(emp.name || '-', margin, y);
    y+=5;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(122,114,101);
    doc.text(`${emp.cargo||'Cargo não informado'}  ·  ${emp.setor||'Setor não informado'}`, margin, y);
    y+=4;
    doc.setFontSize(7); doc.text(`Vínculo: ${emp.vinculo||'Ativo'}  ·  Status: ${emp.status||'Sem dados'}`, margin, y);
    // Foto à direita
    if(emp.foto_url){
      const dataUrl = await getImageDataUrl(emp.foto_url);
      if(dataUrl){
        try{ doc.addImage(dataUrl, 'JPEG', pageW - margin - 26, 16, 26, 26); }catch(e){}
      }
    }
    y+=6;
    doc.setDrawColor(232,213,163); doc.line(margin, y, pageW - margin, y); y+=6;

    function section(title){
      if(y>265){ doc.addPage(); y=14; }
      doc.setFillColor(253,249,240); doc.rect(margin, y-4, pageW - margin*2, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(143,122,58);
      doc.text(title.toUpperCase(), margin+2, y);
      y+=7;
      doc.setFont('helvetica','normal'); doc.setTextColor(46,42,36);
    }
    function row(label, value){
      if(y>272){ doc.addPage(); y=14; }
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(122,114,101);
      doc.text(label+':', margin, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(46,42,36);
      const w = pageW - margin*2 - 34;
      const lines = doc.splitTextToSize(value || '-', w);
      doc.text(lines, margin+34, y);
      y += Math.max(5, lines.length*4 + 1);
    }

    section('Cargo / Função — Salário fixo');
    row('Cargo', emp.cargo || '-');
    row('Setor', emp.setor || '-');
    row('Salário (fixo do cargo)', emp.salario!=null ? formatMoneyBRL(emp.salario) : '-');
    if(emp.cargo_id){ const p = positions.find(x=> String(x.id)===String(emp.cargo_id)); if(p) row('Salário base do cargo', formatMoneyBRL(p.salario_base)); }

    section('Dados pessoais');
    row('CPF', formatCPF(emp.cpf));
    row('RG', formatRG(emp.rg) || '-');
    row('CTPS', emp.ctps_numero || '-');
    row('PIS/PASEP', emp.pis_pasep || '-');
    if(emp.email) row('Email', emp.email);
    if(emp.telefone) row('Telefone', emp.telefone);

    section('Endereço');
    row('CEP', formatCEP(emp.cep) || '-');
    row('Logradouro', `${emp.logradouro||'-'}${emp.numero?', '+emp.numero:''}${emp.complemento?' - '+emp.complemento:''}`);
    row('Bairro', emp.bairro || '-');
    row('Cidade/UF', `${emp.cidade||'-'}${emp.uf?' - '+emp.uf:''}`);

    section('Documentação anexa (links)');
    const docs = [
      ['RG — Frente', emp.rg_frente_url],
      ['RG — Verso', emp.rg_verso_url],
      ['CPF — Cópia', emp.cpf_doc_url],
      ['Comprovante endereço', emp.comprovante_endereco_url],
      ['Carteira Trabalho', emp.ctps_doc_url],
    ];
    docs.forEach(([label, url])=>{
      row(label, url ? url : 'pendente');
      if(url && y < 275){
        doc.setFontSize(6); doc.setTextColor(59,105,120);
        // link clicável
        const linkW = doc.getTextWidth(url);
        if(linkW < pageW - margin*2) doc.link(margin+34, y-4, Math.min(linkW, pageW - margin*2 -34), 4, { url });
        doc.setTextColor(46,42,36);
      }
    });
    // arquivos diversos
    let pdfDiversos = [];
    try{ const { data } = await supabaseClient.from('employee_documents').select('*').eq('employee_id', emp.id).order('created_at'); pdfDiversos = data||[]; }catch(e){}
    section('Arquivos diversos — Certificados / Docs filhos');
    if(pdfDiversos.length===0) row('Arquivos diversos', 'nenhum');
    else pdfDiversos.forEach(d=>{ row((d.tipo==='certificado'?'Certificado': d.tipo==='doc_filho'?'Doc. filho':'Outro')+' — '+d.titulo, d.url || '-'); });

    section('Metadados');
    row('ID', String(emp.id));
    row('Criado em', emp.created_at ? new Date(emp.created_at).toLocaleString('pt-BR') : '-');
    row('Atualizado em', emp.updated_at ? new Date(emp.updated_at).toLocaleString('pt-BR') : '-');

    // Rodapé
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(6); doc.setTextColor(160,150,130);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}  ·  Biofirm Gestão de Colaboradores  ·  ${pageW - margin*2}mm`, margin, footerY);
    doc.setDrawColor(184,148,60); doc.line(margin, footerY-4, pageW - margin, footerY-4);

    const fileName = `Ficha_${(emp.name||'colaborador').replace(/[^a-zA-Z0-9]/g,'_')}_${emp.id}.pdf`;
    doc.save(fileName);
  }

  const btnPrintFichaBtn = document.getElementById('btnPrintFichaBtn');
  if(btnPrintFichaBtn) btnPrintFichaBtn.addEventListener('click', exportFichaPDF);

  function closeViewModal() {
    if (window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(viewModal);
    else viewModal.classList.remove('active');
  }

  if (btnCloseViewModal) btnCloseViewModal.addEventListener('click', closeViewModal);
  if (btnCloseViewBtn) btnCloseViewBtn.addEventListener('click', closeViewModal);

  // Fechar modal ao clicar no fundo
  window.addEventListener('click', function(e) {
    if (e.target === employeeModal) closeModal();
    if (e.target === viewModal) closeViewModal();
    if (e.target === fotoChoiceModal) {
      if (window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(fotoChoiceModal, function(){ if(typeof stopCamera==='function') stopCamera(); });
      else { fotoChoiceModal.classList.remove('active'); if(typeof stopCamera==='function') stopCamera(); }
    }
  });

  // ESC fecha modais com animação
  window.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      if (employeeModal && employeeModal.classList.contains('active')) closeModal();
      if (viewModal && viewModal.classList.contains('active')) closeViewModal();
      if (fotoChoiceModal && fotoChoiceModal.classList.contains('active')) {
        if (window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(fotoChoiceModal, function(){ if(typeof stopCamera==='function') stopCamera(); });
        else fotoChoiceModal.classList.remove('active');
      }
    }
  });

  // Inicializar busca
  fetchPositions();
  fetchEmployees();
  // ESC também fecha cargo modal
  window.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      const cargoModalEl=document.getElementById('cargoModal');
      if(cargoModalEl && cargoModalEl.classList.contains('active')){
        if(window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(cargoModalEl);
        else cargoModalEl.classList.remove('active');
      }
    }
  });
  window.addEventListener('click', function(e){
    const cargoModalEl=document.getElementById('cargoModal');
    if(e.target===cargoModalEl){
      if(window.BiofirmAnimations) window.BiofirmAnimations.closeModalAnimated(cargoModalEl);
      else cargoModalEl.classList.remove('active');
    }
  });
});
