import { demo } from "./demo-data.js";
import { supabase } from "./supabase.js";

// El fallback permite recorrer la beta sin credenciales. Las consultas reales respetan RLS.
export async function getCategories() {
  if (!supabase) return demo.categories;
  const { data, error } = await supabase.from("categories").select("*").eq("is_active", true).order("position");
  if (error) throw error;
  return data;
}

export async function getTopics(category) {
  if (!supabase) return demo.topics.filter(t => !category || t.category === category);
  let query = supabase.from("topics").select("id,title,created_at,category_id,author_id,is_pinned,profiles(username),topic_tags(tags(name)),replies(count)").eq("status", "published").order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
  if (category) query = query.eq("category_id", category);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(t => ({
    id: t.id,
    title: t.title,
    category: t.category_id,
    author: t.profiles?.username || "miembro",
    authorId: t.author_id,
    created: new Date(t.created_at).toLocaleDateString("es-AR"),
    replies: t.replies?.[0]?.count || 0,
    tags: t.topic_tags?.map(x => x.tags?.name).filter(Boolean) || [],
    isPinned: t.is_pinned || false
  }));
}

export async function getTopic(id) {
  if (!supabase) return demo.topics.find(t => t.id === id);
  
  let data, error;
  // Intento 1: Todo (incluido moderated_by join y attachments)
  try {
    const res = await supabase
      .from("topics")
      .select("*,profiles(username),moderator:profiles!moderated_by(username),topic_tags(tags(name)),attachments!topic_id(*),replies(*,profiles(username),attachments!reply_id(*))")
      .eq("id", id)
      .single();
    if (!res.error) {
      data = res.data;
    } else {
      error = res.error;
    }
  } catch (err) {
    error = err;
  }

  // Si falló, intentar sin el join de moderated_by (puede no existir la relación o columna aún)
  if (error) {
    console.warn("Intento 1 de getTopic falló, probando sin join de moderador:", error);
    try {
      const res = await supabase
        .from("topics")
        .select("*,profiles(username),topic_tags(tags(name)),attachments!topic_id(*),replies(*,profiles(username),attachments!reply_id(*))")
        .eq("id", id)
        .single();
      if (!res.error) {
        data = res.data;
        error = null;
      } else {
        error = res.error;
      }
    } catch (err) {
      error = err;
    }
  }

  // Si sigue fallando (por ejemplo por attachments)
  if (error) {
    console.warn("Intento 2 de getTopic falló, probando sin attachments ni moderador:", error);
    try {
      const res = await supabase
        .from("topics")
        .select("*,profiles(username),topic_tags(tags(name)),replies(*,profiles(username))")
        .eq("id", id)
        .single();
      if (!res.error) {
        data = res.data;
        data.attachments = [];
        if (data.replies) {
          data.replies = data.replies.map(r => ({ ...r, attachments: [] }));
        }
        error = null;
      } else {
        throw res.error;
      }
    } catch (err) {
      throw err;
    }
  }

  return {
    id: data.id,
    title: data.title,
    author: data.profiles?.username || "miembro",
    authorId: data.author_id,
    category: data.category_id,
    created: new Date(data.created_at).toLocaleDateString("es-AR"),
    body: data.body,
    isPinned: data.is_pinned || false,
    tags: data.topic_tags?.map(x => x.tags?.name).filter(Boolean) || [],
    moderatedBy: data.moderated_by,
    moderatedByUsername: data.moderator?.username,
    moderated_at: data.moderated_at,
    attachments: (data.attachments || []).map(att => ({
      ...att,
      url: getPublicAttachmentUrl(att.path)
    })),
    responses: data.replies.filter(r => r.status === "published").map(r => ({
      id: r.id,
      author: r.profiles?.username || "miembro",
      authorId: r.author_id,
      created: new Date(r.created_at).toLocaleDateString("es-AR"),
      body: r.body,
      isSpoiler: r.is_spoiler,
      attachments: (r.attachments || []).map(att => ({
        ...att,
        url: getPublicAttachmentUrl(att.path)
      }))
    }))
  };
}

export async function search(query) {
  const q = query.toLowerCase();
  if (!supabase) return { topics:demo.topics.filter(x => `${x.title} ${x.body}`.toLowerCase().includes(q)), problems:demo.problems.filter(x => x.title.toLowerCase().includes(q)) };
  const [topics, problems] = await Promise.all([
    supabase.from("topics").select("id,title").eq("status","published").textSearch("search_vector", query, { config: "spanish", type: "websearch" }),
    supabase.from("problems").select("id,title").eq("status","published").ilike("title", `%${query}%`)
  ]);
  if (topics.error) throw topics.error;
  return {topics:topics.data,problems:problems.data || []};
}

export async function createTopic(payload) {
  if (!supabase) {
    const newId = "topic-" + Math.random().toString(36).substr(2, 9);
    const newTopic = {
      id: newId,
      category: payload.category_id,
      title: payload.title,
      author: "miembro_demo",
      authorId: "demo-user",
      created: "hace instantes",
      replies: 0,
      tags: payload.tags || [],
      body: payload.body,
      responses: []
    };
    demo.topics.unshift(newTopic);
    return { id: newId };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Ingresá para publicar.");
  
  const { tags, ...topicData } = payload;
  
  // No incluir problem_id si es null para evitar conflictos de constraint unique
  if (topicData.problem_id === null || topicData.problem_id === undefined) {
    delete topicData.problem_id;
  }
  
  const { data, error } = await supabase.from("topics").insert({...topicData, author_id:user.id}).select("id").single();
  if (error) throw error;
  
  if (tags && tags.length > 0) {
    for (const tagName of tags) {
      try {
        let tagId;
        const { data: existingTag } = await supabase.from("tags").select("id").eq("name", tagName).maybeSingle();
        if (existingTag) {
          tagId = existingTag.id;
        } else {
          // Intentar insertar el tag; puede fallar si el usuario no tiene permisos
          const { data: newTag, error: tagError } = await supabase.from("tags").insert({ name: tagName }).select("id").single();
          if (tagError) {
            console.warn("No se pudo crear la etiqueta '" + tagName + "' (puede ser una etiqueta existente o falta de permisos):", tagError.message);
            // Intentar buscarla de nuevo por si fue creada por una carrera
            const { data: retryTag } = await supabase.from("tags").select("id").eq("name", tagName).maybeSingle();
            if (retryTag) tagId = retryTag.id;
          } else if (newTag) {
            tagId = newTag.id;
          }
        }
        if (tagId) {
          const { error: ttError } = await supabase.from("topic_tags").insert({ topic_id: data.id, tag_id: tagId });
          if (ttError) console.warn("No se pudo asignar la etiqueta '" + tagName + "':", ttError.message);
        }
      } catch (err) {
        console.error("Error procesando etiqueta:", tagName, err);
      }
    }
  }
  
  return data;
}

export async function updateTopic(id, title, body) {
  if (!supabase) {
    const topic = demo.topics.find(t => t.id === id);
    if (!topic) throw new Error("Tema no encontrado.");
    topic.title = title;
    topic.body = body;
    return topic;
  }
  const { data, error } = await supabase.from("topics").update({ title, body }).eq("id", id).select("id").single();
  if (error) throw error;
  return data;
}

export async function pinTopic(id, isPinned) {
  if (!supabase) {
    const topic = demo.topics.find(t => t.id === id);
    if (!topic) throw new Error("Tema no encontrado.");
    topic.isPinned = isPinned;
    return topic;
  }
  const { data, error } = await supabase.from("topics").update({ is_pinned: isPinned }).eq("id", id).select("id").single();
  if (error) throw error;
  return data;
}

export async function deleteTopic(id) {
  if (!supabase) {
    const index = demo.topics.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Tema no encontrado.");
    demo.topics.splice(index, 1);
    return;
  }
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw error;
}

export async function createReply(topicId, body, isSpoiler) {
  if (!supabase) {
    const topic = demo.topics.find(t => t.id === topicId);
    if (!topic) throw new Error("Tema no encontrado.");
    const newId = "reply-" + Math.random().toString(36).substr(2, 9);
    const newReply = {
      id: newId,
      author: "miembro_demo",
      authorId: "demo-user",
      created: "hace instantes",
      body,
      isSpoiler
    };
    topic.responses.push(newReply);
    topic.replies = (topic.replies || 0) + 1;
    return newReply;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Ingresá para responder.");
  const { data, error } = await supabase.from("replies").insert({ topic_id: topicId, author_id: user.id, body, is_spoiler: isSpoiler, status: "published" }).select("*,profiles(username)").single();
  if (error) throw error;
  return {
    id: data.id,
    author: data.profiles?.username || "miembro",
    authorId: data.author_id,
    created: new Date(data.created_at).toLocaleDateString("es-AR"),
    body: data.body,
    isSpoiler: data.is_spoiler
  };
}

export async function updateReply(id, body) {
  if (!supabase) {
    for (const t of demo.topics) {
      const reply = t.responses.find(r => r.id === id);
      if (reply) {
        reply.body = body;
        return reply;
      }
    }
    throw new Error("Respuesta no encontrada.");
  }
  const { data, error } = await supabase.from("replies").update({ body }).eq("id", id).select("id").single();
  if (error) throw error;
  return data;
}

export async function deleteReply(id) {
  if (!supabase) {
    for (const t of demo.topics) {
      const index = t.responses.findIndex(r => r.id === id);
      if (index !== -1) {
        t.responses.splice(index, 1);
        t.replies = (t.replies || 1) - 1;
        return;
      }
    }
    throw new Error("Respuesta no encontrada.");
  }
  // Con RLS, un DELETE sin filas afectadas no devuelve necesariamente un error.
  // Pedimos la fila eliminada para detectar permisos insuficientes o IDs inexistentes.
  const { data, error } = await supabase.from("replies").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("No tenés permiso para borrar esta respuesta o ya no existe.");
}

export async function createReport(payload) {
  if (!supabase) {
    const reports = JSON.parse(localStorage.getItem("oaf_demo_reports") || "null");
    const defaultReports = [
      {
        id: "rep-demo-1",
        reason: "[Error técnico / Bug] El botón de subir imágenes a veces no responde en Firefox.",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        reporter_id: "user-1",
        profiles: { username: "sofia_fernandez" },
        topic_id: null,
        reply_id: null,
        resolved_at: null
      },
      {
        id: "rep-demo-2",
        reason: "Spam o contenido inapropiado",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        reporter_id: "user-2",
        profiles: { username: "lucas_r" },
        topic_id: "bloque-plano-inclinado",
        topic: { id: "bloque-plano-inclinado", title: "¿Cómo encarar este bloque sobre un plano inclinado?" },
        reply_id: null,
        resolved_at: null
      }
    ];
    const currentReports = reports || defaultReports;
    const newReport = {
      id: "report-" + Math.random().toString(36).substr(2, 9),
      reason: payload.reason,
      created_at: new Date().toISOString(),
      reporter_id: "demo-user",
      profiles: { username: "miembro_demo" },
      topic_id: payload.topic_id || null,
      reply_id: payload.reply_id || null,
      resolved_at: null
    };
    currentReports.push(newReport);
    localStorage.setItem("oaf_demo_reports", JSON.stringify(currentReports));
    console.log("Reporte simulado creado:", newReport);
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Ingresá para reportar contenido.");
  const { error } = await supabase.from("reports").insert({ ...payload, reporter_id: user.id });
  if (error) throw error;
}

export async function archiveRoots() {
  if (!supabase) return demo.archive;
  const { data, error } = await supabase.from("competitions").select("id,title,description,competition_types(title)").order("position");
  if (error) throw error;
  return data.map(x => ({ id:x.id, title:x.title, description:x.description || "", type:x.competition_types?.title || "Competencia" }));
}

export async function archiveChildren(id) {
  if (!supabase) {
    if (demo.archive.some(x=>x.id===id)) return {item:demo.archive.find(x=>x.id===id), label:"Ediciones", items:demo.editions.filter(x=>x.competition===id)};
    if (demo.editions.some(x=>x.id===id)) return {item:demo.editions.find(x=>x.id===id), label:"Niveles", items:demo.levels.filter(x=>x.edition===id)};
    return {item:demo.levels.find(x=>x.id===id), label:"Problemas", items:demo.problems.filter(x=>x.level===id)};
  }
  let {data: edition, error} = await supabase.from("editions").select("*,competitions(title)").eq("competition_id", id).order("position");
  if (!error && edition.length) return {item:{title:edition[0].competitions.title},label:"Ediciones",items:edition.map(x=>({id:x.id,title:x.title,description:x.year?`Año ${x.year}`:""}))};
  let {data: levels, error:levelError} = await supabase.from("levels").select("*,editions(title)").eq("edition_id", id).order("position");
  if (!levelError && levels.length) return {item:{title:levels[0].editions.title},label:"Niveles",items:levels};
  const {data: problems,error:problemError}=await supabase.from("problems").select("*").eq("level_id",id).eq("status","published").order("number");
  if(problemError) throw problemError;
  return {item:{title:"Problemas"},label:"Problemas",items:problems};
}

export async function getProblem(id) {
  if (!supabase) return demo.problems.find(x=>x.id===id);
  let data, error;
  const res = await supabase.from("problems").select("*,topics!problem_id(id),attachments!problem_id(*)").eq("id",id).single();
  data = res.data;
  error = res.error;
  
  if (error) {
    if (error.code === "PGRST200" || error.code === "42P01" || error.message?.includes("attachments") || error.details?.includes("attachments")) {
      console.warn("La tabla 'attachments' no existe o falla en la consulta. Reintentando sin adjuntos:", error);
      const fallbackRes = await supabase.from("problems").select("*,topics!problem_id(id)").eq("id",id).single();
      if (fallbackRes.error) throw fallbackRes.error;
      data = fallbackRes.data;
      data.attachments = [];
      error = null;
    } else {
      throw error;
    }
  }

  return {
    id:data.id,
    number:data.number,
    title:data.title,
    statement:data.statement,
    source:data.source_url || "Archivo OAFForos",
    topicId:Array.isArray(data.topics) ? data.topics[0]?.id : data.topics?.id,
    attachments: (data.attachments || []).map(att => ({
      ...att,
      url: getPublicAttachmentUrl(att.path)
    }))
  };
}

export async function updateProblem(id, data) {
  if (!supabase) {
    const p = demo.problems.find(x => x.id === id);
    if (!p) throw new Error("Problema no encontrado.");
    p.number = parseInt(data.number);
    p.title = data.title;
    p.statement = data.statement;
    p.source = data.source_url || "Archivo OAFForos";
    return p;
  }
  
  const { data: updated, error } = await supabase.from("problems").update({
    number: parseInt(data.number),
    title: data.title,
    statement: data.statement,
    source_url: data.source_url || null
  }).eq("id", id).select("*").single();
  
  if (error) throw error;
  return updated;
}

export async function getCompetitionTypes() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("competition_types").select("*").order("position");
  if (error) throw error;
  return data;
}

export async function getCompetitions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("competitions").select("*").order("position");
  if (error) throw error;
  return data;
}

export async function getEditions(competitionId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("editions").select("*").eq("competition_id", competitionId).order("position");
  if (error) throw error;
  return data;
}

export async function getLevels(editionId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("levels").select("*").eq("edition_id", editionId).order("position");
  if (error) throw error;
  return data;
}

export async function publishProblem(proposalId, data) {
  if (!supabase) {
    const newId = "problem-" + Math.random().toString(36).substr(2, 9);
    const prop = (demo.proposals || []).find(p => p.id === proposalId);
    const newProblem = {
      id: newId,
      level: data.levelId || "oaf-2024-n2",
      number: parseInt(data.problemNumber),
      title: data.problemTitle,
      statement: data.problemStatement,
      source: data.problemSourceUrl || "Archivo OAFForos",
      attachments: prop?.proposal?.attachments || []
    };
    demo.problems.push(newProblem);
    if (prop) {
      prop.status = "approved";
      prop.proposal.reviewerNote = data.reviewerNote || "";
    }
    return newProblem;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");

  // Fetch proposal to copy attachments
  const { data: proposalRow, error: fetchPropError } = await supabase.from("archive_proposals").select("proposal").eq("id", proposalId).single();
  if (fetchPropError) throw fetchPropError;
  const proposalAttachments = proposalRow.proposal?.attachments || [];

  // 1. Competition Type
  let typeId = data.competitionTypeId;
  if (!typeId && data.newCompetitionType) {
    const { data: existing } = await supabase.from("competition_types").select("id").eq("title", data.newCompetitionType).maybeSingle();
    if (existing) {
      typeId = existing.id;
    } else {
      const { data: maxPos } = await supabase.from("competition_types").select("position").order("position", { ascending: false }).limit(1);
      const pos = maxPos && maxPos.length ? (maxPos[0].position + 1) : 1;
      const { data: newType, error } = await supabase.from("competition_types").insert({ title: data.newCompetitionType, position: pos }).select("id").single();
      if (error) throw error;
      typeId = newType.id;
    }
  }

  // 2. Competition
  let compId = data.competitionId;
  if (!compId && data.newCompetition) {
    const { data: existing } = await supabase.from("competitions").select("id").eq("type_id", typeId).eq("title", data.newCompetition).maybeSingle();
    if (existing) {
      compId = existing.id;
    } else {
      const { data: maxPos } = await supabase.from("competitions").select("position").eq("type_id", typeId).order("position", { ascending: false }).limit(1);
      const pos = maxPos && maxPos.length ? (maxPos[0].position + 1) : 1;
      const { data: newComp, error } = await supabase.from("competitions").insert({ type_id: typeId, title: data.newCompetition, description: data.competitionDescription || "", position: pos }).select("id").single();
      if (error) throw error;
      compId = newComp.id;
    }
  }

  // 3. Edition
  let editionId = data.editionId;
  if (!editionId && data.newEdition) {
    const { data: existing } = await supabase.from("editions").select("id").eq("competition_id", compId).eq("title", data.newEdition).maybeSingle();
    if (existing) {
      editionId = existing.id;
    } else {
      const { data: maxPos } = await supabase.from("editions").select("position").eq("competition_id", compId).order("position", { ascending: false }).limit(1);
      const pos = maxPos && maxPos.length ? (maxPos[0].position + 1) : 1;
      const { data: newEd, error } = await supabase.from("editions").insert({ competition_id: compId, title: data.newEdition, year: data.editionYear || null, position: pos }).select("id").single();
      if (error) throw error;
      editionId = newEd.id;
    }
  }

  // 4. Level
  let levelId = data.levelId;
  if (!levelId && data.newLevel) {
    const { data: existing } = await supabase.from("levels").select("id").eq("edition_id", editionId).eq("title", data.newLevel).maybeSingle();
    if (existing) {
      levelId = existing.id;
    } else {
      const { data: maxPos } = await supabase.from("levels").select("position").eq("edition_id", editionId).order("position", { ascending: false }).limit(1);
      const pos = maxPos && maxPos.length ? (maxPos[0].position + 1) : 1;
      const { data: newLev, error } = await supabase.from("levels").insert({ edition_id: editionId, title: data.newLevel, position: pos }).select("id").single();
      if (error) throw error;
      levelId = newLev.id;
    }
  }

  // 5. Create Problem
  const { data: newProblem, error: problemError } = await supabase.from("problems").insert({
    level_id: levelId,
    number: parseInt(data.problemNumber),
    title: data.problemTitle,
    statement: data.problemStatement,
    source_url: data.problemSourceUrl || null,
    status: "published"
  }).select("id").single();
  if (problemError) throw problemError;

  // Link attachments to problem in DB
  if (proposalAttachments.length > 0) {
    const attachmentRows = proposalAttachments.map(att => ({
      problem_id: newProblem.id,
      name: att.name,
      path: att.path,
      type: att.type,
      size: att.size
    }));
    const { error: attError } = await supabase.from("attachments").insert(attachmentRows);
    if (attError) console.error("Error linking attachments to problem:", attError);
  }

  // 6. Update Proposal Status
  const { error: proposalError } = await supabase.from("archive_proposals").update({
    status: "approved",
    reviewer_id: user.id,
    reviewer_note: data.reviewerNote || "",
    reviewed_at: new Date().toISOString()
  }).eq("id", proposalId);
  if (proposalError) throw proposalError;

  return newProblem;
}

export async function createArchiveProposal(proposal) {
  if (!supabase) {
    const newId = "prop-" + Math.random().toString(36).substr(2, 9);
    demo.proposals = demo.proposals || [];
    const newProp = {
      id: newId,
      author: "miembro_demo",
      created: new Date().toLocaleDateString("es-AR"),
      proposal: proposal,
      status: "pending"
    };
    demo.proposals.push(newProp);
    return newProp;
  }
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Ingresá para enviar una propuesta.");
  const {data, error}=await supabase.from("archive_proposals").insert({author_id:user.id,proposal}).select("id").single();
  if(error) throw error;
  return data;
}

export async function getCurrentUserProfile() {
  if (!supabase) return { id: "demo-user", username: "miembro_demo", role: "admin" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!error && data) {
      return data;
    }
    if (error && error.code !== "PGRST116") {
      console.warn(`Attempt ${i + 1} to fetch profile failed:`, error);
    }
    if (i < 2) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  return null;
}

export async function getArchiveProposals() {
  if (!supabase) {
    return (demo.proposals || []).filter(p => p.status === "pending");
  }
  const { data, error } = await supabase.from("archive_proposals")
    .select("*,profiles!author_id(username)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(p => ({
    id: p.id,
    proposal: p.proposal,
    status: p.status,
    author: p.profiles?.username || "miembro",
    created: new Date(p.created_at).toLocaleDateString("es-AR")
  }));
}

export async function updateProposalStatus(id, status, note = "") {
  if (!supabase) {
    const prop = demo.proposals?.find(p => p.id === id);
    if (prop) {
      prop.status = status;
      prop.proposal.reviewerNote = note;
    }
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("archive_proposals")
    .update({ status, reviewer_note: note, reviewer_id: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getReports() {
  if (!supabase) {
    let reports = JSON.parse(localStorage.getItem("oaf_demo_reports"));
    if (!reports) {
      reports = [
        {
          id: "rep-demo-1",
          reason: "[Error técnico / Bug] El botón de subir imágenes a veces no responde en Firefox.",
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
          reporter_id: "user-1",
          profiles: { username: "sofia_fernandez" },
          topic_id: null,
          reply_id: null,
          resolved_at: null
        },
        {
          id: "rep-demo-2",
          reason: "Spam o contenido inapropiado",
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          reporter_id: "user-2",
          profiles: { username: "lucas_r" },
          topic_id: "bloque-plano-inclinado",
          topic: { id: "bloque-plano-inclinado", title: "¿Cómo encarar este bloque sobre un plano inclinado?" },
          reply_id: null,
          resolved_at: null
        }
      ];
      localStorage.setItem("oaf_demo_reports", JSON.stringify(reports));
    }
    const activeReports = reports.filter(r => !r.resolved_at);
    return activeReports.map(r => {
      let topicObj = null;
      if (r.topic_id) {
        const foundTopic = demo.topics.find(t => t.id === r.topic_id);
        if (foundTopic) {
          topicObj = { id: foundTopic.id, title: foundTopic.title };
        } else if (r.topic) {
          topicObj = r.topic;
        }
      }
      let replyObj = null;
      if (r.reply_id) {
        for (const t of demo.topics) {
          const foundReply = t.responses?.find(rep => rep.id === r.reply_id);
          if (foundReply) {
            replyObj = { id: foundReply.id, body: foundReply.body };
            break;
          }
        }
      }
      return {
        id: r.id,
        reason: r.reason,
        created: new Date(r.created_at).toLocaleDateString("es-AR"),
        reporter: r.profiles?.username || "miembro",
        topic: topicObj,
        reply: replyObj
      };
    });
  }
  const { data, error } = await supabase.from("reports")
    .select("*,profiles!reporter_id(username),topics(id,title),replies(id,body)")
    .is("resolved_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(r => ({
    id: r.id,
    reason: r.reason,
    created: new Date(r.created_at).toLocaleDateString("es-AR"),
    reporter: r.profiles?.username || "miembro",
    topic: r.topics ? { id: r.topics.id, title: r.topics.title } : null,
    reply: r.replies ? { id: r.replies.id, body: r.replies.body } : null
  }));
}

export async function resolveReport(id) {
  if (!supabase) {
    const reports = JSON.parse(localStorage.getItem("oaf_demo_reports") || "[]");
    const index = reports.findIndex(r => r.id === id);
    if (index !== -1) {
      reports[index].resolved_at = new Date().toISOString();
      reports[index].resolved_by = "demo-moderator";
      localStorage.setItem("oaf_demo_reports", JSON.stringify(reports));
    }
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("reports")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", id);
  if (error) throw error;
}

export async function checkUsernameTaken(username) {
  if (!supabase) return false;
  // username in profiles must be checked as is or lowercased if needed
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username)
    .maybeSingle();
  if (error && error.code !== "PGRST116") { // PGRST116 is single row expected but 0 returned, which is fine
    console.error("Error checking username:", error);
  }
  return !!data;
}

export async function updateProfileUsername(newUsername) {
  if (!supabase) throw new Error("Configurá Supabase.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No has iniciado sesión.");

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(newUsername)) {
    throw new Error("El username debe tener entre 3 y 30 caracteres (letras, números y guión bajo).");
  }

  const taken = await checkUsernameTaken(newUsername);
  if (taken) {
    throw new Error(`El nombre de usuario '${newUsername}' ya está en uso.`);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: newUsername, username_set: true })
    .eq("id", user.id);

  if (error) throw error;
}

export async function sendPasswordResetEmail(email) {
  if (!supabase) throw new Error("Configurá Supabase.");
  const redirectUrl = window.location.hostname === 'localhost'
    ? window.location.origin
    : 'https://oaf-foros.vercel.app';
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });
  if (error) throw error;
}

export async function updateUserPassword(newPassword) {
  if (!supabase) throw new Error("Configurá Supabase.");
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
}

/**
 * Sube archivos al bucket "attachments" de Supabase Storage.
 * @param {FileList|File[]} files - Archivos a subir
 * @param {string} context - "topic" | "reply" | "problem"
 * @param {string} contextId - ID del topic/reply/problem
 * @returns {Promise<Array<{name, path, url, type, size}>>}
 */
export async function uploadAttachments(files, context, contextId) {
  if (!supabase) {
    // Demo mode: devuelve objetos fake con object URL
    return Array.from(files).map(f => ({
      name: f.name,
      path: `demo/${f.name}`,
      url: URL.createObjectURL(f),
      type: f.type,
      size: f.size
    }));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Ingresá para subir archivos.");

  const results = [];
  for (const file of Array.from(files)) {
    const ext = file.name.split(".").pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context}/${contextId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("attachments")
      .getPublicUrl(path);

    // Save metadata to database public.attachments table (only if context is not proposal)
    if (context === "topic" || context === "reply" || context === "problem") {
      const attachmentRow = {
        name: file.name,
        path,
        type: file.type,
        size: file.size
      };
      if (context === "topic") attachmentRow.topic_id = contextId;
      else if (context === "reply") attachmentRow.reply_id = contextId;
      else if (context === "problem") attachmentRow.problem_id = contextId;

      const { error: dbError } = await supabase.from("attachments").insert(attachmentRow);
      if (dbError) {
        // Si la tabla attachments no existe o hay un error de permisos, advertir pero no bloquear la publicación
        console.error("Error saving attachment metadata to database (el archivo fue subido al storage igualmente):", dbError.message);
        // Solo lanzar si es un error de permisos explícito, no de esquema faltante
        if (dbError.code !== "42P01" && dbError.code !== "PGRST200") {
          throw dbError;
        }
      }
    }

    results.push({
      name: file.name,
      path,
      url: urlData.publicUrl,
      type: file.type,
      size: file.size
    });
  }
  return results;
}

/**
 * Obtiene la URL pública de un archivo en Storage.
 */
export function getPublicAttachmentUrl(path) {
  if (!supabase) return null;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Actualiza un tema y lo marca como editado por el staff de moderación.
 */
export async function updateTopicModerated(id, title, body, moderatorUsername) {
  if (!supabase) {
    const topic = demo.topics.find(t => t.id === id);
    if (!topic) throw new Error("Tema no encontrado.");
    topic.title = title;
    topic.body = body;
    topic.moderatedBy = moderatorUsername || "moderador";
    topic.moderatedAt = new Date().toLocaleDateString("es-AR");
    return topic;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No estás autenticado.");
  const moderationUpdate = await supabase
    .from("topics")
    .update({ title, body, moderated_by: user.id, moderated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (!moderationUpdate.error) return moderationUpdate.data;

  // Las instalaciones anteriores a moderation_update.sql no tienen estas
  // columnas. La edición sigue siendo posible, pero sin la marca de auditoría.
  const message = `${moderationUpdate.error.message || ""} ${moderationUpdate.error.details || ""}`.toLowerCase();
  const missingModerationColumn = moderationUpdate.error.code === "PGRST204"
    || moderationUpdate.error.code === "42703"
    || message.includes("moderated_by")
    || message.includes("moderated_at");
  if (!missingModerationColumn) throw moderationUpdate.error;

  const { data, error } = await supabase
    .from("topics")
    .update({ title, body })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return { ...data, moderationTracked: false };
}

/**
 * Busca usuarios por username (solo para staff).
 */
export async function searchUsersByUsername(query) {
  if (!supabase) {
    // Demo: devuelve usuarios de demo
    return [
      { id: "user-demo-1", username: "sofia_fernandez", email: "sofia@demo.com", role: "member", created_at: new Date().toISOString() },
      { id: "user-demo-2", username: "lucas_r", email: "lucas@demo.com", role: "member", created_at: new Date().toISOString() }
    ].filter(u => u.username.toLowerCase().includes(query.toLowerCase()));
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role, created_at")
    .ilike("username", `%${query}%`)
    .order("username")
    .limit(20);
  if (error) throw error;
  return data;
}

/**
 * Elimina un usuario y todos sus posts (topics + replies).
 * Requiere permisos de service_role o RLS apropiadas.
 */
export async function deleteUserAndPosts(userId) {
  if (!supabase) {
    // Demo: simular eliminación
    demo.topics = demo.topics.filter(t => t.authorId !== userId);
    demo.topics.forEach(t => {
      if (t.responses) t.responses = t.responses.filter(r => r.authorId !== userId);
    });
    return;
  }
  const { data, error } = await supabase.rpc("delete_user_and_content", {
    target_user_id: userId
  });
  if (error) throw error;
  if (data !== true) throw new Error("No se pudo confirmar la eliminación del usuario.");
}

/**
 * Cambia el rol de un usuario (solo admin puede hacer esto).
 */
export async function setUserRole(userId, newRole) {
  if (!supabase) {
    // Demo: no hace nada real
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);
  if (error) throw error;
}
