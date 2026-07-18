import { demo } from "./demo-data.js";
import { configured, supabase, currentUser } from "./supabase.js";
import { getCategories, getTopics, getTopic, search, createTopic, updateTopic, deleteTopic, createReply, updateReply, deleteReply, createReport, archiveRoots, archiveChildren, getProblem, createArchiveProposal, getCurrentUserProfile, getArchiveProposals, updateProposalStatus, getReports, resolveReport, getCompetitionTypes, getCompetitions, getEditions, getLevels, publishProblem, checkUsernameTaken, updateProfileUsername, sendPasswordResetEmail, updateUserPassword, uploadAttachments, updateProblem } from "./api.js";

const main = document.querySelector("main"), modal = document.querySelector("#modal"), notice = document.querySelector("#notice");
let activeProposals = [];
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

const md = text => {
  let safe = esc(text);
  
  // Ecuaciones block $$ ... $$
  safe = safe.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_, equation) => {
    try { return `<div class="math-block">${katex.renderToString(equation, { displayMode: true, throwOnError: false })}</div>`; }
    catch { return equation; }
  });
  
  // Ecuaciones inline $ ... $
  safe = safe.replace(/\$([^$]+)\$/g, (_, equation) => {
    try { return katex.renderToString(equation, { throwOnError: false }); }
    catch { return equation; }
  });

  // Negritas ** ... **
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Cursivas * ... *
  safe = safe.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Código en bloque ``` ... ```
  safe = safe.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Código en línea ` ... `
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Enlaces [texto](url)
  safe = safe.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Saltos de línea
  safe = safe.replace(/\n/g, "<br>");
  
  return safe;
};

function flash(message){ notice.textContent=message;notice.classList.add("show");setTimeout(()=>notice.classList.remove("show"),3200); }
function nav(){document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("active",location.hash.startsWith(a.getAttribute("href"))))}

// ─── Attachments helpers ─────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isImage(type, name) {
  return type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(name || "");
}

/**
 * Renderiza una lista de adjuntos como HTML.
 * Imágenes: vista previa clickable + botón descargar.
 * Archivos: ícono + nombre + botón descargar.
 */
function renderAttachments(attachments) {
  if (!attachments || attachments.length === 0) return "";
  const items = attachments.map(a => {
    if (isImage(a.type, a.name)) {
      return `
        <div class="attachment-item attachment-image">
          <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" class="attachment-preview-link" title="Ver imagen completa">
            <img src="${esc(a.url)}" alt="${esc(a.name)}" class="attachment-img-preview" loading="lazy">
          </a>
          <div class="attachment-meta">
            <span class="attachment-name">${esc(a.name)}</span>
            <a href="${esc(a.url)}" download="${esc(a.name)}" class="attachment-download-btn" title="Descargar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Descargar
            </a>
          </div>
        </div>`;
    } else {
      const isPdf = a.name?.toLowerCase().endsWith(".pdf") || a.type === "application/pdf";
      const icon = isPdf
        ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`
        : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
      return `
        <div class="attachment-item attachment-file">
          <span class="attachment-file-icon">${icon}</span>
          <span class="attachment-name">${esc(a.name)}${a.size ? `<small> · ${formatBytes(a.size)}</small>` : ""}</span>
          <a href="${esc(a.url)}" download="${esc(a.name)}" class="attachment-download-btn" title="Descargar ${esc(a.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar
          </a>
        </div>`;
    }
  }).join("");
  return `<div class="attachments-list">${items}</div>`;
}

/**
 * Crea el HTML del componente de upload de archivos.
 * @param {string} inputId - ID único para el <input type="file">
 * @returns {string} HTML
 */
function buildAttachmentUploaderHTML(inputId) {
  return `
    <div class="attachment-uploader" id="uploader-${inputId}">
      <label class="attachment-upload-label" for="${inputId}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Adjuntar archivos
      </label>
      <input type="file" id="${inputId}" class="attachment-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" style="display:none;">
      <div class="attachment-preview-area" id="preview-${inputId}"></div>
    </div>
  `;
}

/**
 * Inicializa el uploader de archivos en un contenedor.
 * @param {string} inputId - ID del <input type="file">
 * @returns {{ getFiles: () => File[] }} API del uploader
 */
function initAttachmentUploader(inputId) {
  const input = document.getElementById(inputId);
  const previewArea = document.getElementById(`preview-${inputId}`);
  const label = document.querySelector(`label[for="${inputId}"]`);
  let files = [];

  function renderPreview() {
    previewArea.innerHTML = files.map((f, i) => {
      const objectUrl = URL.createObjectURL(f);
      if (isImage(f.type, f.name)) {
        return `<div class="upload-preview-item" data-index="${i}">
          <img src="${objectUrl}" alt="${esc(f.name)}" class="upload-preview-img">
          <button type="button" class="upload-preview-remove" data-index="${i}" title="Quitar">×</button>
          <span class="upload-preview-name">${esc(f.name)}</span>
        </div>`;
      } else {
        const isPdf = f.name.toLowerCase().endsWith(".pdf");
        return `<div class="upload-preview-item upload-preview-file" data-index="${i}">
          <span class="upload-preview-file-icon">${isPdf ? "📄" : "📎"}</span>
          <span class="upload-preview-name">${esc(f.name)}</span>
          <small>${formatBytes(f.size)}</small>
          <button type="button" class="upload-preview-remove" data-index="${i}" title="Quitar">×</button>
        </div>`;
      }
    }).join("");

    // Revoke object URLs on next tick to avoid memory leaks (they render before we revoke)
    previewArea.querySelectorAll(".upload-preview-remove").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"));
        files.splice(idx, 1);
        renderPreview();
      };
    });
  }

  input.addEventListener("change", () => {
    const newFiles = Array.from(input.files);
    // Limit total 10 files
    const combined = [...files, ...newFiles].slice(0, 10);
    files = combined;
    input.value = "";
    renderPreview();
  });

  return {
    getFiles: () => files,
    clear: () => { files = []; renderPreview(); }
  };
}

const topicRow = t => `<a class="topic-row" href="#tema/${t.id}"><span class="topic-count"><b>${t.replies ?? 0}</b>respuestas</span><span><h3>${esc(t.title)}</h3><span class="topic-meta">${esc(t.author)} · ${esc(t.created)}</span><br>${(t.tags||[]).map(x=>`<i class="tag">${esc(x)}</i>`).join("")}</span><span class="muted">›</span></a>`;

const icons = { mecanica: "↗", electromagnetismo: "ϟ", termodinamica: "◌", ondas: "≈", moderna: "◈", comunidad: "○" };
const getIcon = id => icons[id] || "○";

async function home(){
  const topics=await getTopics();
  const categories = await getCategories();
  main.innerHTML=`<section class="hero"><div class="eyebrow">Comunidad argentina de física olímpica</div><h1>Pensar la física, entre pares.</h1><p>Un lugar para discutir problemas, compartir ideas y construir un archivo vivo de competencias de física.</p><a class="button" href="#foro">Explorar el foro</a></section><section class="section"><div class="section-head"><div><div class="eyebrow">Espacios de discusión</div><h2>Elegí una rama. Traé una pregunta.</h2></div><a class="text-link" href="#foro">Ver el foro →</a></div><div class="grid cards-3">${categories.slice(0,3).map(c=>`<a class="card" href="#foro/${c.id}"><span class="category-icon">${getIcon(c.id)}</span><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p></a>`).join("")}</div></section><section class="section two-column"><div><div class="eyebrow">Conversaciones recientes</div><h2>Lo que se está pensando ahora</h2><div class="feed">${topics.slice(0,4).map(topicRow).join("")}</div></div><aside class="sidebar-box"><h3>El archivo de problemas</h3><p>Recorré competencias, ediciones y niveles. Cada problema abre una conversación para resolverlo en comunidad.</p><a class="text-link" href="#archivo">Ir al archivo →</a></aside></section>
  <section class="section" style="border-top:1px solid var(--line); padding-top:3rem;">
    <div style="background:var(--pale); border:1px solid var(--line); padding:2rem; display:flex; align-items:center; justify-content:space-between; gap:2rem; flex-wrap:wrap;">
      <div style="max-width:680px;">
        <div class="eyebrow" style="color:var(--blue)">¿Encontraste un error?</div>
        <h3 style="font-family:var(--serif); font-size:1.5rem; margin:0.4rem 0; color:var(--navy);">Ayudanos a mejorar OAFForos</h3>
        <p style="color:var(--muted); margin:0; font-size:0.9rem;">Si ves algún error, bug, o tenés sugerencias para mejorar el sitio, podés reportarlo directamente a nuestro equipo de moderación.</p>
      </div>
      <div>
        <button class="button" id="feedback-trigger-btn" style="background:var(--blue); white-space:nowrap; font-size:0.9rem;">Reportar error / Feedback</button>
      </div>
    </div>
  </section>`;
}

async function forum(category){
  const topics=await getTopics(category);
  const categories = await getCategories();
  const cat = categories.find(x=>x.id===category);
  const categoryName = cat?.title;
  const categoryDesc = cat?.description;
  main.innerHTML=`<section class="page-head"><div class="eyebrow">Foro</div><h1>${esc(categoryName||"Preguntas que hacen avanzar")}</h1><p>${esc(categoryName?categoryDesc:"Un espacio para hacer preguntas, discutir soluciones y aprender con otros estudiantes y entrenadores.")}</p></section><section class="forum-layout"><div class="section-head"><span class="muted">${topics.length} temas</span><a class="button" href="#nuevo-tema">Crear tema</a></div>${!category?`<div class="category-list">${categories.map(c=>`<a class="category-card" href="#foro/${c.id}"><span class="category-icon">${getIcon(c.id)}</span><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p></a>`).join("")}</div><h2 style="margin-top:3rem;font-family:var(--serif)">Actividad reciente</h2>`:""}<div class="feed">${topics.length?topics.map(topicRow).join(""):'<p class="empty">Todavía no hay temas en esta categoría.</p>'}</div></section>`;
}

async function archive(){
  let entries=await archiveRoots();
  let types=[...new Set(entries.map(x=>x.type))];
  main.innerHTML=`<section class="page-head"><div class="eyebrow">Archivo de enunciados</div><h1>Problemas para volver a pensar.</h1><p>Un recorrido ordenado por competencias de física. Los aportes de la comunidad se publican después de una revisión.</p></section><section class="forum-layout"><div class="filter-bar"><select id="archive-type"><option value="">Todos los tipos</option>${types.map(x=>`<option>${esc(x)}</option>`).join("")}</select><a class="button button-quiet" href="#proponer">Proponer una entrada</a></div><div id="archive-results" class="archive-list">${archiveItems(entries)}</div></section>`;
  document.querySelector("#archive-type").onchange=e=>document.querySelector("#archive-results").innerHTML=archiveItems(entries.filter(x=>!e.target.value||x.type===e.target.value));
}

const archiveItems=items=>items.map(x=>`<a class="archive-item" href="#archivo/${x.id}"><span><strong>${esc(x.title)}</strong><small>${esc(x.type)} · ${esc(x.description)}</small></span><span>›</span></a>`).join("");

async function archiveDetail(id){
  let {item,label,items}=await archiveChildren(id);
  if(!item){return archive();}
  main.innerHTML=`<section class="page-head"><div class="eyebrow">Archivo / ${label}</div><h1>${esc(item.title)}</h1><p>${esc(item.description||"Seleccioná una entrada para continuar el recorrido.")}</p></section><section class="forum-layout"><p class="archive-path"><a href="#archivo">Archivo</a> <span>/</span> ${label}</p><div class="archive-list">${items.map(x=>`<a class="archive-item" href="#${x.number?"problema":"archivo"}/${x.id}"><span><strong>${x.number?`Problema ${x.number}: `:""}${esc(x.title)}</strong><small>${esc(x.source||x.description||"")}</small></span><span>›</span></a>`).join("")}</div></section>`;
}

async function problem(id){
  let p=await getProblem(id);
  if(!p)return archive();
  const user = await currentUser();
  const profile = await getCurrentUserProfile();
  
  let discussionHTML = "";
  if(p.topicId){
    discussionHTML = `<a class="button" href="#tema/${p.topicId}">Abrir discusión y soluciones</a>`;
  } else {
    if(user) {
      discussionHTML = `<div style="margin-top:1.5rem;"><p class="muted" style="margin-bottom:0.8rem;">Este problema todavía no tiene una discusión asociada.</p><a class="button" href="#nuevo-tema/${p.id}">Crear discusión para este problema</a></div>`;
    } else {
      discussionHTML = `<p class="muted">Este problema todavía no tiene una discusión asociada. <button class="button button-quiet" id="reply-auth-btn" style="margin-top:0.5rem; display:block;">Ingresá para iniciar la discusión</button></p>`;
    }
  }

  let editBtnHTML = "";
  if (profile && (profile.role === "moderator" || profile.role === "admin")) {
    editBtnHTML = `
      <div style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem;">
        <button class="button button-quiet" id="edit-problem-btn" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">✏️ Editar problema</button>
      </div>
    `;
  }

  main.innerHTML=`<article class="topic">
    <div class="eyebrow">${esc(p.source)}</div>
    <h1>Problema ${p.number}: ${esc(p.title)}</h1>
    ${editBtnHTML}
    <div class="topic-body">${md(p.statement)}</div>
    ${renderAttachments(p.attachments || [])}
    ${discussionHTML}
    <p class="muted" style="margin-top:2rem;">Las soluciones pueden contener spoilers y se muestran ocultas por defecto.</p>
  </article>`;

  if (document.getElementById("edit-problem-btn")) {
    document.getElementById("edit-problem-btn").onclick = () => showEditProblemModal(p);
  }
}

async function showEditProblemModal(p) {
  modal.style.width = "min(650px, calc(100% - 2rem))";
  modal.innerHTML = `
    <div class="modal-content" style="width: 100%;">
      <button class="icon-button" style="float:right" id="modal-close-btn">×</button>
      <h2 style="font-family:var(--serif); margin-bottom: 0.5rem;">Editar Problema</h2>
      <p class="muted" style="margin-bottom: 1.5rem;">Modificá los datos del problema oficial.</p>
      
      <form id="edit-problem-form">
        <div style="display:grid; grid-template-columns: 80px 1fr; gap:0.5rem;">
          <div>
            <label for="edit-prob-number" style="font-size:0.8rem; font-weight:600;">Número</label>
            <input class="input" type="number" id="edit-prob-number" min="1" required value="${p.number}">
          </div>
          <div>
            <label for="edit-prob-title" style="font-size:0.8rem; font-weight:600;">Título</label>
            <input class="input" id="edit-prob-title" required value="${esc(p.title)}">
          </div>
        </div>

        <div class="form-row" style="margin-top:0.8rem;">
          <label for="edit-prob-statement">Enunciado (Markdown + LaTeX)</label>
          <textarea id="edit-prob-statement" required style="min-height:150px; font-family:var(--sans); width: 100%;">${esc(p.statement)}</textarea>
        </div>

        <div class="form-row">
          <label for="edit-prob-source">Enlace a la fuente (URL)</label>
          <input class="input" type="url" id="edit-prob-source" value="${esc(p.source.startsWith('http') ? p.source : '')}" placeholder="https://...">
        </div>

        <button class="button" style="margin-top:1rem; width:100%;">Guardar cambios</button>
      </form>
    </div>
  `;
  
  document.getElementById("modal-close-btn").onclick = () => modal.close();
  modal.showModal();

  document.getElementById("edit-problem-form").onsubmit = async ev => {
    ev.preventDefault();
    const payload = {
      number: document.getElementById("edit-prob-number").value,
      title: document.getElementById("edit-prob-title").value.trim(),
      statement: document.getElementById("edit-prob-statement").value.trim(),
      source_url: document.getElementById("edit-prob-source").value.trim()
    };

    try {
      await updateProblem(p.id, payload);
      modal.close();
      flash("Problema actualizado con éxito.");
      await problem(p.id); // Recargar la página del problema para ver los cambios
    } catch (err) {
      alert("Error al actualizar el problema: " + err.message);
    }
  };
}

async function topic(id){
  const t=await getTopic(id);
  if(!t){location.hash="#foro";return;}
  
  const user = await currentUser();
  let topicActions = "";
  if (user) {
    if (user.id === t.authorId) {
      topicActions += `<button class="action-btn edit-topic-btn" data-id="${t.id}">Editar</button> `;
      topicActions += `<button class="action-btn delete-topic-btn" data-id="${t.id}" style="color:var(--danger)">Borrar</button> `;
    }
    topicActions += `<button class="action-btn report-btn" data-topic-id="${t.id}">Reportar</button>`;
  }
  
  let repliesHTML = "";
  if (t.responses && t.responses.length > 0) {
    repliesHTML = t.responses.map(r=> {
      let replyActions = "";
      if (user) {
        if (user.id === r.authorId) {
          replyActions += `<button class="action-btn edit-reply-btn" data-id="${r.id}">Editar</button> `;
          replyActions += `<button class="action-btn delete-reply-btn" data-id="${r.id}" style="color:var(--danger)">Borrar</button> `;
        }
        replyActions += `<button class="action-btn report-btn" data-reply-id="${r.id}">Reportar</button>`;
      }
      const attachmentsHTML = renderAttachments(r.attachments || []);
      return `<section class="reply" id="reply-${r.id}">
        <div class="reply-head">
          <b>${esc(r.author)}</b>
          <span>${esc(r.created)} ${replyActions}</span>
        </div>
        ${r.isSpoiler?`<details class="spoiler"><summary>Mostrar spoiler</summary><div class="reply-body" data-raw="${esc(r.body)}">${md(r.body)}</div>${attachmentsHTML}</details>`:`<div class="reply-body" data-raw="${esc(r.body)}">${md(r.body)}</div>${attachmentsHTML}`}
      </section>`;
    }).join("");
  } else {
    repliesHTML = '<p class="empty">Aún no hay respuestas en este tema.</p>';
  }

  let replyFormHTML = "";
  if (user) {
    replyFormHTML = `
      <section class="reply-form-section" style="border-top:1px solid var(--line); padding-top:2rem; margin-top:2rem;">
        <h3 style="font-family:var(--serif)">Agregar respuesta</h3>
        <form id="reply-form">
          <div class="form-row">
            <textarea id="reply-body" class="input" placeholder="Escribí tu respuesta aquí..." required style="min-height:100px;"></textarea>
          </div>
          <div class="form-row" style="display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0;">
            <input type="checkbox" id="reply-spoiler">
            <label for="reply-spoiler" style="font-size:0.9rem; font-weight:normal; cursor:pointer;">Marcar como spoiler (ocultar por defecto)</label>
          </div>
          ${buildAttachmentUploaderHTML("reply-files")}
          <button class="button" style="margin-top:0.8rem;">Enviar respuesta</button>
        </form>
      </section>
    `;
  } else {
    replyFormHTML = `
      <section class="reply" style="text-align: center; border-top:1px solid var(--line); padding-top:2rem; margin-top:2rem;">
        <p class="muted">Para participar en la discusión, <button class="button button-quiet" id="reply-auth-btn">Ingresá con tu cuenta</button></p>
      </section>
    `;
  }

  main.innerHTML=`<article class="topic">
    <div class="eyebrow">Foro · ${esc(t.category||"Tema")}</div>
    <h1>${esc(t.title)}</h1>
    <p class="topic-meta">${esc(t.author)} · ${esc(t.created)} ${topicActions}</p>
    <div class="topic-body" data-raw="${esc(t.body)}">${md(t.body)}</div>
    ${renderAttachments(t.attachments || [])}
    <div style="margin-top:1rem; margin-bottom: 2rem;">
      ${(t.tags||[]).map(x=>`<i class="tag">${esc(x)}</i>`).join("")}
    </div>
    <h2 style="font-family:var(--serif); margin-top:3rem;">Respuestas</h2>
    <div class="replies-container">
      ${repliesHTML}
    </div>
    ${replyFormHTML}
  </article>`;

  // Init reply uploader after DOM update
  if (user) {
    window.__replyUploader = initAttachmentUploader("reply-files");
  }
}

async function newTopic(problemId){
  const categories = await getCategories();
  let prefilledTitle = "";
  let problemInfo = "";
  if (problemId) {
    try {
      const p = await getProblem(problemId);
      if (p) {
        prefilledTitle = `Discusión: Problema ${p.number} - ${p.title}`;
        problemInfo = `<div class="notice-info" style="background:var(--pale); padding:0.8rem; margin-bottom:1rem; border-left:4px solid var(--blue); font-size:0.9rem; color:var(--navy)">Creando discusión asociada al <strong>Problema ${p.number}: ${esc(p.title)}</strong> (${esc(p.source)}).</div>`;
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  main.innerHTML=`<section class="new-topic">
    <div class="eyebrow">Foro</div>
    <h1>Crear un tema</h1>
    <p class="muted">Explicá qué intentaste y usá LaTeX entre signos $ para las ecuaciones.</p>
    ${problemInfo}
    <form id="topic-form">
      <div class="form-row">
        <label for="category">Categoría</label>
        <select class="input" id="category">${categories.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select>
      </div>
      <div class="form-row">
        <label for="title">Título</label>
        <input class="input" id="title" required maxlength="160" value="${esc(prefilledTitle)}">
      </div>
      <div class="form-row">
        <label for="tags">Etiquetas (separadas por coma)</label>
        <input class="input" id="tags" placeholder="Ej.: dinamica, oaf-2024">
      </div>
      <div class="form-row">
        <label for="body">Pregunta o desarrollo</label>
        <textarea id="body" required></textarea>
      </div>
      ${buildAttachmentUploaderHTML("topic-files")}
      <button class="button" style="margin-top:0.8rem;">Publicar tema</button>
    </form>
  </section>`;

  const topicUploader = initAttachmentUploader("topic-files");

  document.querySelector("#topic-form").onsubmit=async e=>{
    e.preventDefault();
    const submitBtn = e.target.querySelector(".button:not([type='button'])") || e.target.querySelector(".button");
    try{
      submitBtn.disabled = true;
      submitBtn.textContent = "Publicando...";
      let f=e.target;
      let tagsList = f.tags.value.split(",")
        .map(t => t.toLowerCase().trim().replace(/[^a-z0-9-]/g, ""))
        .filter(t => t.length >= 2 && t.length <= 40);
        
      let row=await createTopic({
        category_id:f.category.value,
        title:f.title.value,
        body:f.body.value,
        tags: tagsList,
        problem_id: problemId || null
      });

      // Upload attachments if any
      const files = topicUploader.getFiles();
      if (files.length > 0) {
        try {
          const uploaded = await uploadAttachments(files, "topic", row.id);
          if (!supabase) {
            const topicObj = demo.topics.find(t => t.id === row.id);
            if (topicObj) {
              topicObj.attachments = uploaded;
            }
          }
        } catch(uploadErr) {
          flash("Tema publicado, pero hubo un error al subir los archivos: " + uploadErr.message);
        }
      }

      location.hash=`#tema/${row.id}`;
    }catch(err){
      flash(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Publicar tema";
    }
  }
}

function about(){
  main.innerHTML=`<section class="page-head">
    <div class="eyebrow">Acerca de OAFForos</div>
    <h1>Un archivo y una conversación.</h1>
    <p>OAFForos es un proyecto comunitario para estudiantes, docentes, entrenadores y exolímpicos de física de la Olimpíada Argentina de Física.</p>
  </section>
  <section class="section two-column">
    <div>
      <h2>Pautas de Convivencia</h2>
      <p>Tratamos las soluciones y discusiones académicas como conversaciones de aprendizaje:</p>
      <ul>
        <li><strong>Respeto absoluto:</strong> Todos fuimos principiantes. Fomentamos preguntas honestas y respuestas constructivas.</li>
        <li><strong>Políticas de Spoilers:</strong> Para no arruinar el desafío a otros estudiantes, ocultá las respuestas que revelen soluciones parciales o totales marcándolas como "spoiler" al responder.</li>
        <li><strong>Edición comunitaria:</strong> No hay puntajes de reputación ni votos. La precisión de las respuestas se alcanza conversando y refinando las ideas colectivamente.</li>
      </ul>
      
      <h2>Contacto de Moderación</h2>
      <p>Si encontrás algún comportamiento inapropiado que requiera atención del equipo, podés usar el botón de <em>Reportar</em> en cada publicación o escribir a <a href="mailto:moderacion@oafforos.com">moderacion@oafforos.com</a>.</p>
      
      <h2>Política de Privacidad Básica</h2>
      <p>OAFForos respeta tu privacidad:</p>
      <ul>
        <li><strong>Datos de registro:</strong> Solo almacenamos tu dirección de correo electrónico (para verificar tu cuenta y permitir el acceso) y tu nombre de usuario público.</li>
        <li><strong>Uso de datos:</strong> No compartimos tus datos con terceros ni los utilizamos para fines comerciales.</li>
        <li><strong>Cookies:</strong> Se utilizan cookies estrictamente necesarias para mantener la sesión iniciada mediante Supabase Auth.</li>
      </ul>
    </div>
    <aside class="sidebar-box">
      <h3>¿Querés aportar al archivo?</h3>
      <p>Cualquier miembro registrado puede proponer problemas oficiales y sus soluciones recomendadas. El equipo de moderadores revisará y publicará las propuestas.</p>
      <a class="text-link" href="#proponer">Proponer una entrada →</a>
    </aside>
  </section>`;
}

function propose(){
  main.innerHTML=`<section class="new-topic">
    <div class="eyebrow">Archivo de enunciados</div>
    <h1>Proponer una entrada</h1>
    <p class="muted">Las propuestas se revisan antes de aparecer en el archivo. Incluí la fuente para que el equipo pueda verificarla.</p>
    <form id="proposal-form">
      <div class="form-row">
        <label for="competition">Competencia y edición</label>
        <input class="input" id="competition" required placeholder="Ej.: OAF, instancia nacional 2024">
      </div>
      <div class="form-row">
        <label for="level">Nivel y número del problema</label>
        <input class="input" id="level" required placeholder="Ej.: Nivel 2, problema 3">
      </div>
      <div class="form-row">
        <label for="source">Enlace a la fuente</label>
        <input class="input" id="source" type="url" placeholder="https://…">
      </div>
      <div class="form-row">
        <label for="statement">Enunciado o corrección propuesta</label>
        <textarea id="statement" required></textarea>
      </div>
      ${buildAttachmentUploaderHTML("proposal-files")}
      <button class="button" style="margin-top:0.8rem;">Enviar para revisión</button>
    </form>
  </section>`;

  const proposalUploader = initAttachmentUploader("proposal-files");

  document.querySelector("#proposal-form").onsubmit=async e=>{
    e.preventDefault();
    const submitBtn = e.target.querySelector(".button");
    try{
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando..."; }
      let f=e.target;
      const proposalPayload = {
        competition: f.competition.value,
        level: f.level.value,
        source_url: f.source.value,
        statement: f.statement.value
      };
      const newProp = await createArchiveProposal(proposalPayload);
      
      // Upload attachments if any
      const files = proposalUploader.getFiles();
      if (files.length > 0) {
        try {
          const uploaded = await uploadAttachments(files, "proposal", newProp.id);
          proposalPayload.attachments = uploaded;
          if (supabase) {
            await supabase.from("archive_proposals").update({ proposal: proposalPayload }).eq("id", newProp.id);
          } else {
            const prop = demo.proposals.find(p => p.id === newProp.id);
            if (prop) prop.proposal = proposalPayload;
          }
        } catch(uploadErr) {
          flash("Propuesta enviada, pero hubo un error al subir los archivos: " + uploadErr.message);
        }
      }

      flash("Propuesta enviada para revisión.");
      location.hash="#archivo";
    }catch(err){
      flash(err.message);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enviar para revisión"; }
    }
  }
}

async function searchPage(query) {
  const q = query ? decodeURIComponent(query) : "";
  main.innerHTML = `
    <section class="page-head">
      <div class="eyebrow">Búsqueda</div>
      <h1>Buscar en el foro y el archivo</h1>
      <p>Buscá discusiones del foro o enunciados de problemas por palabras clave.</p>
      <form id="search-page-form" style="display:flex; gap:0.5rem; margin-top:1.5rem; max-width:600px;">
        <input type="text" class="input" id="search-input" value="${esc(q)}" placeholder="Escribí tu búsqueda..." required style="flex-grow:1;">
        <button class="button">Buscar</button>
      </form>
    </section>
    <section class="forum-layout" id="search-results-section">
      ${q ? '<p class="muted">Buscando...</p>' : ''}
    </section>
  `;
  
  if (q) {
    try {
      const r = await search(q);
      const resultsDiv = document.getElementById("search-results-section");
      resultsDiv.innerHTML = `
        <h2>Foro</h2>
        <div class="feed">
          ${r.topics.length ? r.topics.map(t => topicRow({ ...t, replies: t.replies || 0, author: t.author || "" })).join("") : '<p class="empty">Sin temas coincidentes.</p>'}
        </div>
        <h2 style="margin-top:2rem;">Archivo</h2>
        <div class="archive-list">
          ${r.problems.length ? r.problems.map(p => `<a class="archive-item" href="#problema/${p.id}"><strong>${esc(p.title)}</strong><span>›</span></a>`).join("") : '<p class="empty">Sin problemas coincidentes.</p>'}
        </div>
      `;
    } catch (err) {
      flash(err.message);
    }
  }

  document.getElementById("search-page-form").onsubmit = e => {
    e.preventDefault();
    const val = document.getElementById("search-input").value.trim();
    if (val) {
      location.hash = `#buscar/${encodeURIComponent(val)}`;
    }
  };
}

async function moderationPage() {
  const profile = await getCurrentUserProfile();
  if (!profile || (profile.role !== "moderator" && profile.role !== "admin")) {
    location.hash = "#inicio";
    return;
  }
  
  main.innerHTML = `
    <section class="page-head">
      <div class="eyebrow">Administración</div>
      <h1>Consola de moderación</h1>
      <p>Revisá las propuestas de problemas recibidas y atendé los reportes de la comunidad.</p>
    </section>
    <section class="forum-layout">
      <div class="two-column">
        <div>
          <h2 style="font-family:var(--serif)">Propuestas pendientes</h2>
          <div id="proposals-list" class="feed">Cargando propuestas...</div>
        </div>
        <aside class="sidebar-box" style="border-top-color:var(--danger);">
          <h3 style="font-family:var(--serif)">Reportes activos</h3>
          <div id="reports-list">Cargando reportes...</div>
        </aside>
      </div>
    </section>
  `;

  // Cargar propuestas
  try {
    activeProposals = await getArchiveProposals();
    const propDiv = document.getElementById("proposals-list");
    if (activeProposals.length === 0) {
      propDiv.innerHTML = '<p class="empty">No hay propuestas pendientes de revisión.</p>';
    } else {
      propDiv.innerHTML = activeProposals.map(p => `
        <div class="card" style="margin-bottom:1rem; border-left:4px solid var(--gold);" id="prop-${p.id}">
          <span class="topic-meta">Propuesta por <strong>${esc(p.author)}</strong> el ${esc(p.created)}</span>
          <h3 style="margin-top:0.5rem; font-size:1.15rem;">${esc(p.proposal.competition)}</h3>
          <p style="font-size:0.9rem; margin:0.3rem 0;"><strong>Ubicación:</strong> ${esc(p.proposal.level)}</p>
          ${p.proposal.source_url ? `<p style="font-size:0.9rem; margin:0.3rem 0;"><strong>Fuente:</strong> <a href="${esc(p.proposal.source_url)}" target="_blank">${esc(p.proposal.source_url)}</a></p>` : ''}
          <div style="background:var(--pale); padding:0.8rem; font-size:0.9rem; font-family:var(--mono); white-space:pre-wrap; margin:0.5rem 0; border:1px solid var(--line);">${esc(p.proposal.statement)}</div>
          ${renderAttachments(p.proposal.attachments || [])}
          <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
            <button class="button btn-approve-proposal" data-id="${p.id}">Aprobar</button>
            <button class="button button-quiet btn-reject-proposal" data-id="${p.id}">Rechazar</button>
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    document.getElementById("proposals-list").innerHTML = `<p class="muted">Error al cargar propuestas: ${esc(err.message)}</p>`;
  }

  // Cargar reportes
  try {
    const reports = await getReports();
    const repDiv = document.getElementById("reports-list");
    if (reports.length === 0) {
      repDiv.innerHTML = '<p class="empty">No hay reportes activos.</p>';
    } else {
      repDiv.innerHTML = reports.map(r => `
        <div style="border-bottom:1px solid var(--line); padding:0.8rem 0;" id="rep-${r.id}">
          <span class="topic-meta">Reportado por <strong>${esc(r.reporter)}</strong> el ${esc(r.created)}</span>
          <p style="font-size:0.9rem; margin:0.3rem 0; color:var(--danger);"><strong>Razón:</strong> ${esc(r.reason)}</p>
          <div style="background:#fff; border:1px dashed var(--line); padding:0.5rem; font-size:0.85rem; margin:0.5rem 0; color:var(--muted)">
            ${r.topic ? `<strong>Tema:</strong> <a href="#tema/${r.topic.id}">${esc(r.topic.title)}</a>` : ''}
            ${r.reply ? `<strong>Respuesta:</strong> ${md(r.reply.body)}` : ''}
            ${(!r.topic && !r.reply) ? `<span style="color:var(--blue); font-weight:600;">Reporte general / Feedback</span>` : ''}
          </div>
          <button class="button button-quiet btn-resolve-report" data-id="${r.id}" style="padding:0.3rem 0.6rem; font-size:0.75rem;">Resolver</button>
        </div>
      `).join("");
    }
  } catch (err) {
    document.getElementById("reports-list").innerHTML = `<p class="muted">Error al cargar reportes: ${esc(err.message)}</p>`;
  }
}
async function showApproveProposalModal(p) {
  let types = [];
  let competitions = [];
  try {
    types = await getCompetitionTypes();
    competitions = await getCompetitions();
  } catch (err) {
    console.error("Error loading archive metadata:", err);
  }

  modal.style.width = "min(650px, calc(100% - 2rem))";
  modal.innerHTML = `
    <div class="modal-content" style="width: 100%;">
      <button class="icon-button" style="float:right" id="modal-close-btn">×</button>
      <h2 style="font-family:var(--serif); margin-bottom: 0.5rem;">Publicar en el archivo</h2>
      <p class="muted" style="margin-bottom: 1.5rem;">Asigná la propuesta a la estructura del archivo y publicala.</p>
      
      <div style="background:var(--pale); padding:0.8rem; font-size:0.85rem; border-left:3px solid var(--gold); margin-bottom:1.5rem; max-height:150px; overflow-y:auto; color: var(--ink);">
        <strong>Propuesta original:</strong><br>
        • Competencia: ${esc(p.proposal.competition)}<br>
        • Nivel/Problema: ${esc(p.proposal.level)}<br>
        • Fuente: ${p.proposal.source_url ? `<a href="${esc(p.proposal.source_url)}" target="_blank">${esc(p.proposal.source_url)}</a>` : 'No provista'}<br>
        • Enunciado: <span style="font-family:var(--mono);">${esc(p.proposal.statement)}</span>
      </div>

      <form id="approve-proposal-form">
        <div class="form-row">
          <label for="modal-type-select">Tipo de competencia</label>
          <select class="input" id="modal-type-select" required>
            <option value="">-- Seleccionar existente --</option>
            ${types.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}
            <option value="new">-- Crear nuevo tipo --</option>
          </select>
          <input class="input" id="modal-type-new" placeholder="Nombre del nuevo tipo de competencia..." style="margin-top:0.5rem; display:none;">
        </div>

        <div class="form-row">
          <label for="modal-comp-select">Competencia</label>
          <select class="input" id="modal-comp-select" required disabled>
            <option value="">-- Seleccionar tipo primero --</option>
          </select>
          <input class="input" id="modal-comp-new" placeholder="Nombre de la nueva competencia..." style="margin-top:0.5rem; display:none;">
          <input class="input" id="modal-comp-desc" placeholder="Descripción de la competencia (opcional)..." style="margin-top:0.5rem; display:none;">
        </div>

        <div class="form-row">
          <label for="modal-edition-select">Edición / Año</label>
          <select class="input" id="modal-edition-select" required disabled>
            <option value="">-- Seleccionar competencia primero --</option>
          </select>
          <input class="input" id="modal-edition-new" placeholder="Ej.: Edición 2024..." style="margin-top:0.5rem; display:none;">
          <input class="input" id="modal-edition-year" type="number" min="1900" max="2100" placeholder="Año (ej. 2024, opcional)..." style="margin-top:0.5rem; display:none;">
        </div>

        <div class="form-row">
          <label for="modal-level-select">Nivel</label>
          <select class="input" id="modal-level-select" required disabled>
            <option value="">-- Seleccionar edición primero --</option>
          </select>
          <input class="input" id="modal-level-new" placeholder="Ej.: Nivel 1..." style="margin-top:0.5rem; display:none;">
        </div>

        <div style="border-top: 1px solid var(--line); margin-top:1.5rem; padding-top:1rem;">
          <h4 style="font-family:var(--serif); margin:0 0 0.8rem 0;">Datos del problema</h4>
          
          <div style="display:grid; grid-template-columns: 80px 1fr; gap:0.5rem;">
            <div>
              <label for="modal-prob-number" style="font-size:0.8rem; font-weight:600;">Número</label>
              <input class="input" type="number" id="modal-prob-number" min="1" required placeholder="Ej. 1">
            </div>
            <div>
              <label for="modal-prob-title" style="font-size:0.8rem; font-weight:600;">Título</label>
              <input class="input" id="modal-prob-title" required placeholder="Ej. Movimiento parabólico">
            </div>
          </div>

          <div class="form-row" style="margin-top:0.8rem;">
            <label for="modal-prob-statement">Enunciado (Markdown + LaTeX)</label>
            <textarea id="modal-prob-statement" required style="min-height:100px; font-family:var(--sans); width: 100%;">${esc(p.proposal.statement)}</textarea>
          </div>

          <div class="form-row">
            <label for="modal-prob-source">Enlace a la fuente (URL)</label>
            <input class="input" type="url" id="modal-prob-source" value="${esc(p.proposal.source_url)}" placeholder="https://...">
          </div>
        </div>

        <div class="form-row">
          <label for="modal-reviewer-note">Nota del revisor (se guarda en la propuesta)</label>
          <input class="input" id="modal-reviewer-note" placeholder="Ej. Aprobado y publicado.">
        </div>

        <button class="button" style="margin-top:1rem; width:100%;">Aprobar y Publicar</button>
      </form>
    </div>
  `;
  
  document.getElementById("modal-close-btn").onclick = () => modal.close();
  modal.showModal();

  const typeSelect = document.getElementById("modal-type-select");
  const typeNew = document.getElementById("modal-type-new");
  const compSelect = document.getElementById("modal-comp-select");
  const compNew = document.getElementById("modal-comp-new");
  const compDesc = document.getElementById("modal-comp-desc");
  const editionSelect = document.getElementById("modal-edition-select");
  const editionNew = document.getElementById("modal-edition-new");
  const editionYear = document.getElementById("modal-edition-year");
  const levelSelect = document.getElementById("modal-level-select");
  const levelNew = document.getElementById("modal-level-new");

  // Handle Competition Type change
  typeSelect.onchange = async () => {
    const val = typeSelect.value;
    if (val === "new") {
      typeNew.style.display = "block";
      typeNew.required = true;
      compSelect.innerHTML = `<option value="new">-- Crear nueva competencia --</option>`;
      compSelect.value = "new";
      compSelect.disabled = false;
      compSelect.onchange();
    } else if (val) {
      typeNew.style.display = "none";
      typeNew.required = false;
      compSelect.disabled = false;
      compSelect.innerHTML = `<option value="">Cargando competencias...</option>`;
      const filteredComps = competitions.filter(c => c.type_id === val);
      compSelect.innerHTML = `
        <option value="">-- Seleccionar existente --</option>
        ${filteredComps.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}
        <option value="new">-- Crear nueva competencia --</option>
      `;
      compSelect.value = "";
      compSelect.onchange();
    } else {
      typeNew.style.display = "none";
      typeNew.required = false;
      compSelect.disabled = true;
      compSelect.value = "";
      compSelect.onchange();
    }
  };

  // Handle Competition change
  compSelect.onchange = async () => {
    const val = compSelect.value;
    if (val === "new") {
      compNew.style.display = "block";
      compNew.required = true;
      compDesc.style.display = "block";
      editionSelect.innerHTML = `<option value="new">-- Crear nueva edición --</option>`;
      editionSelect.value = "new";
      editionSelect.disabled = false;
      editionSelect.onchange();
    } else if (val) {
      compNew.style.display = "none";
      compNew.required = false;
      compDesc.style.display = "none";
      editionSelect.disabled = false;
      editionSelect.innerHTML = `<option value="">Cargando ediciones...</option>`;
      try {
        const eds = await getEditions(val);
        editionSelect.innerHTML = `
          <option value="">-- Seleccionar existente --</option>
          ${eds.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join("")}
          <option value="new">-- Crear nueva edición --</option>
        `;
      } catch (err) {
        console.error(err);
        editionSelect.innerHTML = `<option value="new">-- Crear nueva edición --</option>`;
      }
      editionSelect.value = "";
      editionSelect.onchange();
    } else {
      compNew.style.display = "none";
      compNew.required = false;
      compDesc.style.display = "none";
      editionSelect.disabled = true;
      editionSelect.value = "";
      editionSelect.onchange();
    }
  };

  // Handle Edition change
  editionSelect.onchange = async () => {
    const val = editionSelect.value;
    if (val === "new") {
      editionNew.style.display = "block";
      editionNew.required = true;
      editionYear.style.display = "block";
      levelSelect.innerHTML = `<option value="new">-- Crear nuevo nivel --</option>`;
      levelSelect.value = "new";
      levelSelect.disabled = false;
      levelSelect.onchange();
    } else if (val) {
      editionNew.style.display = "none";
      editionNew.required = false;
      editionYear.style.display = "none";
      levelSelect.disabled = false;
      levelSelect.innerHTML = `<option value="">Cargando niveles...</option>`;
      try {
        const levs = await getLevels(val);
        levelSelect.innerHTML = `
          <option value="">-- Seleccionar existente --</option>
          ${levs.map(l => `<option value="${l.id}">${esc(l.title)}</option>`).join("")}
          <option value="new">-- Crear nuevo nivel --</option>
        `;
      } catch (err) {
        console.error(err);
        levelSelect.innerHTML = `<option value="new">-- Crear nuevo nivel --</option>`;
      }
      levelSelect.value = "";
      levelSelect.onchange();
    } else {
      editionNew.style.display = "none";
      editionNew.required = false;
      editionYear.style.display = "none";
      levelSelect.disabled = true;
      levelSelect.value = "";
      levelSelect.onchange();
    }
  };

  // Handle Level change
  levelSelect.onchange = () => {
    const val = levelSelect.value;
    if (val === "new") {
      levelNew.style.display = "block";
      levelNew.required = true;
    } else {
      levelNew.style.display = "none";
      levelNew.required = false;
    }
  };

  // Handle Submit
  document.getElementById("approve-proposal-form").onsubmit = async ev => {
    ev.preventDefault();
    const payload = {
      competitionTypeId: typeSelect.value !== "new" ? typeSelect.value : null,
      newCompetitionType: typeSelect.value === "new" ? typeNew.value.trim() : null,
      competitionId: compSelect.value !== "new" ? compSelect.value : null,
      newCompetition: compSelect.value === "new" ? compNew.value.trim() : null,
      competitionDescription: compSelect.value === "new" ? compDesc.value.trim() : null,
      editionId: editionSelect.value !== "new" ? editionSelect.value : null,
      newEdition: editionSelect.value === "new" ? editionNew.value.trim() : null,
      editionYear: (editionSelect.value === "new" && editionYear.value) ? parseInt(editionYear.value) : null,
      levelId: levelSelect.value !== "new" ? levelSelect.value : null,
      newLevel: levelSelect.value === "new" ? levelNew.value.trim() : null,
      problemNumber: document.getElementById("modal-prob-number").value,
      problemTitle: document.getElementById("modal-prob-title").value.trim(),
      problemStatement: document.getElementById("modal-prob-statement").value.trim(),
      problemSourceUrl: document.getElementById("modal-prob-source").value.trim(),
      reviewerNote: document.getElementById("modal-reviewer-note").value.trim()
    };

    try {
      await publishProblem(p.id, payload);
      modal.close();
      flash("Problema publicado y propuesta aprobada con éxito.");
      document.getElementById(`prop-${p.id}`)?.remove();
    } catch (err) {
      alert("Error al publicar: " + err.message);
    }
  };
}

function auth(){
  location.hash = "#ingresar";
}

async function updateAuth(){
  let u=await currentUser();
  let username = "Ingresar";
  
  const nav = document.querySelector("nav");
  if (u || !configured) {
    try {
      const profile = await getCurrentUserProfile();
      if (profile) {
        username = profile.username;
        if (!profile.username_set && !location.hash.startsWith("#establecer-username")) {
          location.hash = "#establecer-username";
        }
      } else {
        username = u?.user_metadata?.username || u?.email || "miembro_demo";
      }
      
      let modLink = document.querySelector("#nav-moderacion");
      if (profile && (profile.role === "moderator" || profile.role === "admin")) {
        if (!modLink) {
          modLink = document.createElement("a");
          modLink.href = "#moderacion";
          modLink.id = "nav-moderacion";
          modLink.textContent = "Moderación";
          modLink.setAttribute("data-route", "moderacion");
          nav.appendChild(modLink);
        }
      } else if (modLink) {
        modLink.remove();
      }
    } catch (err) {
      console.error("Error fetching profile for auth update:", err);
      username = u?.user_metadata?.username || u?.email || "miembro_demo";
    }
  } else {
    let modLink = document.querySelector("#nav-moderacion");
    if (modLink) {
      modLink.remove();
    }
  }
  
  document.querySelector("#auth-button").textContent = username;
}

async function router(){
  nav();
  let hash = location.hash.slice(1);
  if (hash.includes("access_token=") || hash.includes("error=")) {
    if (hash.includes("type=recovery")) {
      location.hash = "#restablecer-contrasena";
      return;
    }
    location.hash = "#";
    // Continue processing after resetting hash
    hash = "";
  }
  let [route,id]=hash.split("/");

  let u = await currentUser();
  if (u) {
    try {
      const profile = await getCurrentUserProfile();
      if (profile && !profile.username_set && route !== "establecer-username") {
        location.hash = "#establecer-username";
        return;
      }
    } catch (err) {
      console.error("Error checking profile username_set:", err);
    }
  }

  try{
    if(route==="foro")await forum(id);
    else if(route==="archivo") {if(id)await archiveDetail(id);else await archive()}
    else if(route==="problema")await problem(id);
    else if(route==="tema")await topic(id);
    else if(route==="nuevo-tema")await newTopic(id);
    else if(route==="proponer")propose();
    else if(route==="acerca")about();
    else if(route==="buscar")await searchPage(id);
    else if(route==="moderacion")await moderationPage();
    else if(route==="ingresar")await ingresarPage();
    else if(route==="establecer-username")await establecerUsernamePage();
    else if(route==="restablecer-contrasena")await restablecerContrasenaPage();
    else await home();
  }catch(e){
    console.error(e);
    flash("No pudimos cargar este contenido.");
  }
}

async function establecerUsernamePage() {
  const u = await currentUser();
  if (!u) {
    location.hash = "#ingresar";
    return;
  }
  
  const profile = await getCurrentUserProfile();
  if (profile && profile.username_set) {
    location.hash = "#";
    return;
  }

  main.innerHTML = `
    <section class="page-head" style="text-align: center;">
      <div class="eyebrow">Configuración</div>
      <h1>Elige tu nombre de usuario</h1>
      <p>Para completar tu registro, por favor elige un nombre de usuario único.</p>
    </section>
    <section class="forum-layout" style="max-width: 480px; margin: auto; padding-bottom: 5rem;">
      <div class="sidebar-box" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 2rem;">
        <form id="username-setup-form">
          <div class="form-row">
            <label for="setup-username">Nombre de usuario (username)</label>
            <input class="input" type="text" id="setup-username" required placeholder="ej. Kepler_88" pattern="^[a-zA-Z0-9_]{3,30}$" title="De 3 a 30 caracteres. Solo letras, números y guión bajo (_).">
            <small class="muted" style="display: block; margin-top: 0.25rem; font-size: 0.75rem;">De 3 a 30 caracteres. Solo letras, números y guión bajo (_).</small>
          </div>
          <button class="button" style="width: 100%; margin-top: 1rem; padding: 0.8rem;">Guardar y continuar</button>
        </form>
        <div style="text-align: center; margin-top: 1.5rem;">
          <button class="button button-quiet" id="cancel-setup-btn" style="color: var(--muted); font-size: 0.9rem;">Cerrar sesión</button>
        </div>
      </div>
    </section>
  `;

  document.getElementById("username-setup-form").onsubmit = async e => {
    e.preventDefault();
    const newUsername = document.getElementById("setup-username").value.trim();
    try {
      await updateProfileUsername(newUsername);
      flash("¡Nombre de usuario guardado!");
      await updateAuth();
      location.hash = "#";
    } catch (err) {
      flash("Error: " + err.message);
    }
  };

  document.getElementById("cancel-setup-btn").onclick = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      flash("Sesión cerrada.");
      await updateAuth();
      location.hash = "#ingresar";
    }
  };
}

async function restablecerContrasenaPage() {
  const u = await currentUser();
  if (!u) {
    flash("Enlace no válido o expirado. Por favor solicita el restablecimiento de contraseña de nuevo.");
    location.hash = "#ingresar";
    return;
  }

  main.innerHTML = `
    <section class="page-head" style="text-align: center;">
      <div class="eyebrow">Seguridad</div>
      <h1>Nueva contraseña</h1>
      <p>Establece una nueva contraseña para tu cuenta.</p>
    </section>
    <section class="forum-layout" style="max-width: 480px; margin: auto; padding-bottom: 5rem;">
      <div class="sidebar-box" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 2rem;">
        <form id="reset-password-form">
          <div class="form-row">
            <label for="reset-new-password">Nueva contraseña</label>
            <input class="input" type="password" id="reset-new-password" required minlength="6" placeholder="Mínimo 6 caracteres">
          </div>
          <button class="button" style="width: 100%; margin-top: 1rem; padding: 0.8rem;">Actualizar contraseña</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("reset-password-form").onsubmit = async e => {
    e.preventDefault();
    const newPassword = document.getElementById("reset-new-password").value;
    try {
      await updateUserPassword(newPassword);
      flash("Tu contraseña ha sido actualizada. Por favor inicia sesión con tu nueva contraseña.");
      if (supabase) {
        await supabase.auth.signOut();
      }
      await updateAuth();
      location.hash = "#ingresar";
    } catch (err) {
      flash("Error: " + err.message);
    }
  };
}

async function ingresarPage() {
  const u = await currentUser();
  
  if (u) {
    const profile = await getCurrentUserProfile();
    const username = profile ? profile.username : (u.user_metadata?.username || "miembro");
    main.innerHTML = `
      <section class="page-head" style="text-align: center;">
        <div class="eyebrow">Mi Cuenta</div>
        <h1>Sesión iniciada</h1>
        <p>Hola, <strong>${esc(username)}</strong>. Estás conectado con el correo ${esc(u.email)}.</p>
      </section>
      <section class="forum-layout" style="max-width: 480px; margin: auto; padding-bottom: 5rem; display: flex; flex-direction: column; gap: 2rem;">
        <div class="sidebar-box" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 2rem;">
          <h3 style="margin-bottom: 1rem; font-family: var(--serif); text-align: center;">Seguridad</h3>
          <p class="muted" style="font-size: 0.9rem; margin-bottom: 1.5rem; text-align: center;">Para cambiar tu contraseña, te enviaremos un correo electrónico de verificación.</p>
          <button class="button" id="reset-password-request-btn" style="width: 100%; padding: 0.8rem;">Enviar correo de cambio de contraseña</button>
        </div>

        <div class="sidebar-box" style="text-align: center; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 2rem;">
          <h3 style="margin-bottom: 1.5rem; font-family: var(--serif);">Cerrar Sesión</h3>
          <button class="button btn-danger" id="logout-btn" style="width: 100%; padding: 0.8rem;">Cerrar Sesión</button>
        </div>
      </section>
    `;
    
    document.getElementById("reset-password-request-btn").onclick = async () => {
      try {
        await sendPasswordResetEmail(u.email);
        flash("Correo de restablecimiento enviado. Por favor verifica tu bandeja de entrada.");
      } catch (err) {
        flash("Error: " + err.message);
      }
    };
    
    document.getElementById("logout-btn").onclick = async () => {
      if (supabase) {
        await supabase.auth.signOut();
        flash("Sesión cerrada.");
        await updateAuth();
        location.hash = "#";
      }
    };
    return;
  }
  
  main.innerHTML = `
    <section class="page-head" style="text-align: center;">
      <div class="eyebrow">Acceso</div>
      <h1>Únete a OAFForos</h1>
      <p>Inicia sesión o regístrate para participar en el foro y proponer problemas.</p>
    </section>
    <section class="forum-layout" style="max-width: 480px; margin: auto; padding-bottom: 5rem;">
      <div class="sidebar-box" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 2rem;">
        <!-- Tabs -->
        <div style="display: flex; border-bottom: 2px solid var(--line); margin-bottom: 1.5rem; justify-content: space-around;">
          <button id="tab-login" class="action-btn" style="flex: 1; padding: 0.8rem; font-size: 1rem; text-decoration: none; border-bottom: 3px solid var(--gold); font-weight: 600; color: var(--navy); background: transparent;">Iniciar Sesión</button>
          <button id="tab-signup" class="action-btn" style="flex: 1; padding: 0.8rem; font-size: 1rem; text-decoration: none; border-bottom: 3px solid transparent; font-weight: 500; color: var(--muted); background: transparent;">Crear Cuenta</button>
        </div>
        
        <!-- Formulario Iniciar Sesión -->
        <form id="login-form">
          <div class="form-row">
            <label for="login-email">Correo electrónico</label>
            <input class="input" type="email" id="login-email" required placeholder="tu@correo.com">
          </div>
          <div class="form-row">
            <label for="login-password">Contraseña</label>
            <input class="input" type="password" id="login-password" required minlength="6" placeholder="••••••••">
          </div>
          <button class="button" style="width: 100%; margin-top: 1rem; padding: 0.8rem;">Ingresar</button>
        </form>
        
        <!-- Formulario Crear Cuenta -->
        <form id="signup-form" style="display: none;">
          <div class="form-row">
            <label for="signup-email">Correo electrónico</label>
            <input class="input" type="email" id="signup-email" required placeholder="tu@correo.com">
          </div>
          <div class="form-row">
            <label for="signup-username">Nombre de usuario (username)</label>
            <input class="input" type="text" id="signup-username" required placeholder="ej. Newton_99" pattern="^[a-zA-Z0-9_]{3,30}$" title="De 3 a 30 caracteres. Solo letras, números y guión bajo (_).">
            <small class="muted" style="display: block; margin-top: 0.25rem; font-size: 0.75rem;">De 3 a 30 caracteres. Solo letras, números y guión bajo (_).</small>
          </div>
          <div class="form-row">
            <label for="signup-password">Contraseña</label>
            <input class="input" type="password" id="signup-password" required minlength="6" placeholder="Mínimo 6 caracteres">
          </div>
          <button class="button" style="width: 100%; margin-top: 1rem; padding: 0.8rem;">Registrarse</button>
        </form>
        
        <div style="display: flex; align-items: center; margin: 1.5rem 0;">
          <hr style="flex: 1; border: 0; border-top: 1px solid var(--line);">
          <span class="muted" style="margin: 0 1rem; font-size: 0.8rem;">O bien</span>
          <hr style="flex: 1; border: 0; border-top: 1px solid var(--line);">
        </div>
        
        <button class="button button-quiet" id="google-btn" style="width: 100%; padding: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>
      </div>
    </section>
  `;
  
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  
  tabLogin.onclick = () => {
    tabLogin.style.borderBottomColor = "var(--gold)";
    tabLogin.style.color = "var(--navy)";
    tabLogin.style.fontWeight = "600";
    
    tabSignup.style.borderBottomColor = "transparent";
    tabSignup.style.color = "var(--muted)";
    tabSignup.style.fontWeight = "500";
    
    loginForm.style.display = "block";
    signupForm.style.display = "none";
  };
  
  tabSignup.onclick = () => {
    tabSignup.style.borderBottomColor = "var(--gold)";
    tabSignup.style.color = "var(--navy)";
    tabSignup.style.fontWeight = "600";
    
    tabLogin.style.borderBottomColor = "transparent";
    tabLogin.style.color = "var(--muted)";
    tabLogin.style.fontWeight = "500";
    
    loginForm.style.display = "none";
    signupForm.style.display = "block";
  };
  
  loginForm.onsubmit = async e => {
    e.preventDefault();
    if (!supabase) return flash("Configurá Supabase para habilitar cuentas.");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        flash("Error al iniciar sesión: " + error.message);
      } else {
        flash("Sesión iniciada.");
        await updateAuth();
        location.hash = "#";
      }
    } catch (err) {
      flash("Error: " + err.message);
    }
  };
  
  signupForm.onsubmit = async e => {
    e.preventDefault();
    if (!supabase) return flash("Configurá Supabase para habilitar cuentas.");
    const email = document.getElementById("signup-email").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return flash("El username debe tener entre 3 y 30 caracteres (letras, números y guión bajo).");
    }
    
    try {
      const taken = await checkUsernameTaken(username);
      if (taken) {
        return flash("El nombre de usuario '" + username + "' ya está en uso.");
      }
      
      const redirectUrl = window.location.hostname === 'localhost' 
        ? window.location.origin 
        : 'https://oaf-foros.vercel.app';
        
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username
          },
          emailRedirectTo: redirectUrl
        }
      });
      
      if (error) {
        flash("Error al registrarse: " + error.message);
      } else {
        flash("Registro exitoso. Revisa tu correo para verificar la cuenta.");
        signupForm.reset();
        tabLogin.click();
      }
    } catch (err) {
      flash("Error: " + err.message);
    }
  };
  
  document.getElementById("google-btn").onclick = async () => {
    if (!supabase) return flash("Configurá Supabase para habilitar cuentas.");
    
    const redirectUrl = window.location.hostname === 'localhost' 
      ? window.location.origin 
      : 'https://oaf-foros.vercel.app';
      
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl
        }
      });
      if (error) {
        flash("Error con Google: " + error.message);
      }
    } catch (err) {
      flash("Error: " + err.message);
    }
  };
}

// Event Listeners globales en main para edición y reporte
main.addEventListener("click", async e => {
  // Editar respuesta
  if (e.target.classList.contains("edit-reply-btn")) {
    const replyId = e.target.getAttribute("data-id");
    const replySection = document.getElementById(`reply-${replyId}`);
    const bodyDiv = replySection.querySelector(".reply-body");
    const rawText = bodyDiv.getAttribute("data-raw");
    
    if (replySection.querySelector(".edit-form")) return;
    
    bodyDiv.innerHTML = `
      <div class="edit-form">
        <textarea class="input" style="width:100%; min-height:80px; margin-bottom:0.5rem; font-family:var(--sans);">${esc(rawText)}</textarea>
        <div style="display:flex; gap:0.5rem;">
          <button class="button btn-save-reply" data-id="${replyId}">Guardar</button>
          <button class="button button-quiet btn-cancel-reply">Cancelar</button>
        </div>
      </div>
    `;
  }
  
  if (e.target.classList.contains("btn-cancel-reply")) {
    const [route, id] = location.hash.slice(1).split("/");
    await topic(id);
  }
  
  if (e.target.classList.contains("btn-save-reply")) {
    const replyId = e.target.getAttribute("data-id");
    const textarea = e.target.closest(".edit-form").querySelector("textarea");
    const newBody = textarea.value.trim();
    if (!newBody) return flash("El contenido no puede estar vacío.");
    try {
      await updateReply(replyId, newBody);
      flash("Respuesta actualizada.");
      const [route, id] = location.hash.slice(1).split("/");
      await topic(id);
    } catch (err) {
      flash(err.message);
    }
  }

  // Editar tema
  if (e.target.classList.contains("edit-topic-btn")) {
    const topicId = e.target.getAttribute("data-id");
    const topicBody = main.querySelector(".topic-body");
    const rawText = topicBody.getAttribute("data-raw");
    const titleH1 = main.querySelector("h1");
    const currentTitle = titleH1.textContent;
    
    if (topicBody.querySelector(".edit-form")) return;
    
    titleH1.innerHTML = `<input type="text" class="input edit-topic-title" value="${esc(currentTitle)}" style="width:100%;">`;
    topicBody.innerHTML = `
      <div class="edit-form">
        <textarea class="input edit-topic-text" style="width:100%; min-height:180px; margin-bottom:0.5rem; font-family:var(--sans);">${esc(rawText)}</textarea>
        <div style="display:flex; gap:0.5rem;">
          <button class="button btn-save-topic" data-id="${topicId}">Guardar Cambios</button>
          <button class="button button-quiet btn-cancel-topic">Cancelar</button>
        </div>
      </div>
    `;
  }
  
  if (e.target.classList.contains("btn-cancel-topic")) {
    const [route, id] = location.hash.slice(1).split("/");
    await topic(id);
  }
  
  if (e.target.classList.contains("btn-save-topic")) {
    const topicId = e.target.getAttribute("data-id");
    const newTitle = main.querySelector(".edit-topic-title").value.trim();
    const newBody = main.querySelector(".edit-topic-text").value.trim();
    if (!newTitle || !newBody) return flash("El título y el cuerpo no pueden estar vacíos.");
    try {
      await updateTopic(topicId, newTitle, newBody);
      flash("Tema actualizado.");
      const [route, id] = location.hash.slice(1).split("/");
      await topic(id);
    } catch (err) {
      flash(err.message);
    }
  }

  // Borrar tema
  if (e.target.classList.contains("delete-topic-btn")) {
    const topicId = e.target.getAttribute("data-id");
    if (confirm("¿Estás seguro de que querés borrar este tema y todas sus respuestas?")) {
      try {
        await deleteTopic(topicId);
        flash("Tema eliminado con éxito.");
        location.hash = "#foro";
      } catch (err) {
        flash("Error al eliminar el tema: " + err.message);
      }
    }
  }

  // Borrar respuesta
  if (e.target.classList.contains("delete-reply-btn")) {
    const replyId = e.target.getAttribute("data-id");
    if (confirm("¿Estás seguro de que querés borrar esta respuesta?")) {
      try {
        await deleteReply(replyId);
        flash("Respuesta eliminada con éxito.");
        const [route, id] = location.hash.slice(1).split("/");
        await topic(id);
      } catch (err) {
        flash("Error al eliminar la respuesta: " + err.message);
      }
    }
  }

  // Reportes
  if (e.target.classList.contains("report-btn")) {
    const topicId = e.target.getAttribute("data-topic-id");
    const replyId = e.target.getAttribute("data-reply-id");
    
    modal.style.width = "";
    modal.innerHTML = `
      <div class="modal-content">
        <button class="icon-button" style="float:right" onclick="this.closest('dialog').close()">×</button>
        <h2>Reportar contenido</h2>
        <p class="muted">Describí brevemente por qué considerás que este contenido infringe las normas de convivencia.</p>
        <form id="report-form">
          <div class="form-row">
            <textarea id="report-reason" class="input" style="min-height:100px;" placeholder="Motivo del reporte..." required></textarea>
          </div>
          <button class="button btn-danger">Enviar reporte</button>
        </form>
      </div>
    `;
    modal.showModal();
    
    modal.querySelector("#report-form").onsubmit = async ev => {
      ev.preventDefault();
      const reason = modal.querySelector("#report-reason").value.trim();
      try {
        await createReport({
          topic_id: topicId || null,
          reply_id: replyId || null,
          reason
        });
        modal.close();
        flash("Reporte enviado a los moderadores.");
      } catch (err) {
        flash(err.message);
      }
    };
  }

  // Botón de feedback en la página de inicio
  if (e.target.id === "feedback-trigger-btn") {
    const profile = await getCurrentUserProfile();
    
    modal.style.width = "";
    if (!profile) {
      modal.innerHTML = `
        <div class="modal-content">
          <button class="icon-button" style="float:right" onclick="this.closest('dialog').close()">×</button>
          <h2>Reportar un error</h2>
          <p class="muted" style="margin-bottom:1.5rem;">Para enviar feedback o reportar errores en la plataforma, debés ingresar con tu cuenta.</p>
          <button class="button" onclick="this.closest('dialog').close(); location.hash='#ingresar';">Iniciar sesión</button>
        </div>
      `;
    } else {
      modal.innerHTML = `
        <div class="modal-content">
          <button class="icon-button" style="float:right" onclick="this.closest('dialog').close()">×</button>
          <h2>Reportar un error / Feedback</h2>
          <p class="muted" style="margin-bottom:1rem;">Contanos qué error encontraste o qué sugerencia tenés para mejorar la plataforma.</p>
          <form id="feedback-form">
            <div class="form-row">
              <label for="feedback-type">Tipo de reporte</label>
              <select id="feedback-type" class="input" required>
                <option value="Error técnico / Bug">Error técnico / Bug</option>
                <option value="Sugerencia de diseño">Sugerencia de diseño</option>
                <option value="Error de contenido / Enunciado">Error de contenido / Enunciado</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div class="form-row">
              <label for="feedback-reason">Descripción del error o sugerencia</label>
              <textarea id="feedback-reason" class="input" style="min-height:120px;" placeholder="Sé lo más descriptivo posible..." maxlength="1000" required></textarea>
            </div>
            <button class="button" style="background:var(--blue); width:100%; margin-top:0.5rem;">Enviar feedback</button>
          </form>
        </div>
      `;
      modal.showModal();
      
      modal.querySelector("#feedback-form").onsubmit = async ev => {
        ev.preventDefault();
        const type = modal.querySelector("#feedback-type").value;
        const reason = modal.querySelector("#feedback-reason").value.trim();
        if (reason.length < 3) {
          return flash("La descripción debe tener al menos 3 caracteres.");
        }
        const submitBtn = modal.querySelector(".button");
        try {
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando..."; }
          await createReport({
            reason: `[${type}] ${reason}`,
            topic_id: null,
            reply_id: null
          });
          modal.close();
          flash("¡Gracias por tu reporte! Los moderadores lo revisarán pronto.");
        } catch (err) {
          flash(err.message);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enviar feedback"; }
        }
      };
      return;
    }
    modal.showModal();
  }

  // Aprobación de propuesta
  if (e.target.classList.contains("btn-approve-proposal")) {
    const id = e.target.getAttribute("data-id");
    const p = activeProposals.find(x => x.id === id);
    if (p) {
      showApproveProposalModal(p);
    }
  }

  // Rechazo de propuesta
  if (e.target.classList.contains("btn-reject-proposal")) {
    const id = e.target.getAttribute("data-id");
    const note = prompt("Nota de rechazo (requerida para explicar el motivo):");
    if (!note) {
      if (note === "") flash("Debes ingresar un motivo para el rechazo.");
      return;
    }
    try {
      await updateProposalStatus(id, "rejected", note);
      flash("Propuesta rechazada.");
      document.getElementById(`prop-${id}`)?.remove();
    } catch (err) {
      flash(err.message);
    }
  }

  // Resolver reporte
  if (e.target.classList.contains("btn-resolve-report")) {
    const id = e.target.getAttribute("data-id");
    try {
      await resolveReport(id);
      flash("Reporte marcado como resuelto.");
      document.getElementById(`rep-${id}`)?.remove();
    } catch (err) {
      flash(err.message);
    }
  }

  // Login en formulario de respuestas y problema
  if (e.target.id === "reply-auth-btn") {
    auth();
  }
});

// Enviar respuesta
main.addEventListener("submit", async e => {
  if (e.target.id === "reply-form") {
    e.preventDefault();
    const [route, topicId] = location.hash.slice(1).split("/");
    const body = e.target.querySelector("#reply-body").value.trim();
    const isSpoiler = e.target.querySelector("#reply-spoiler").checked;
    if (!body) return;
    const submitBtn = e.target.querySelector(".button");
    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando..."; }
      const reply = await createReply(topicId, body, isSpoiler);

      // Upload attachments if any
      if (window.__replyUploader) {
        const files = window.__replyUploader.getFiles();
        if (files.length > 0) {
          try {
            const uploaded = await uploadAttachments(files, "reply", reply.id);
            if (!supabase) {
              const topicObj = demo.topics.find(t => t.id === topicId);
              if (topicObj) {
                const replyObj = topicObj.responses.find(r => r.id === reply.id);
                if (replyObj) {
                  replyObj.attachments = uploaded;
                }
              }
            }
          } catch(uploadErr) {
            flash("Respuesta publicada, pero error al subir archivos: " + uploadErr.message);
          }
        }
      }

      flash("Respuesta publicada.");
      await topic(topicId);
    } catch (err) {
      flash(err.message);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enviar respuesta"; }
    }
  }
});


document.querySelector("#search-toggle").onclick = () => { location.hash = "#buscar"; };
document.querySelector("#auth-button").onclick=auth;
window.addEventListener("hashchange",router);
if(supabase)supabase.auth.onAuthStateChange(updateAuth);
if(!configured)setTimeout(()=>flash("Modo demostración: configurá Supabase para publicar."),800);
updateAuth();
router();
