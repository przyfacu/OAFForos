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
  let query = supabase.from("topics").select("id,title,created_at,category_id,author_id,profiles(username),topic_tags(tags(name)),replies(count)").eq("status", "published").order("created_at", { ascending: false });
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
    tags: t.topic_tags?.map(x => x.tags?.name).filter(Boolean) || []
  }));
}

export async function getTopic(id) {
  if (!supabase) return demo.topics.find(t => t.id === id);
  const { data, error } = await supabase.from("topics").select("*,profiles(username),topic_tags(tags(name)),replies(*,profiles(username))").eq("id", id).single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    author: data.profiles?.username || "miembro",
    authorId: data.author_id,
    category: data.category_id,
    created: new Date(data.created_at).toLocaleDateString("es-AR"),
    body: data.body,
    tags: data.topic_tags?.map(x => x.tags?.name).filter(Boolean) || [],
    responses: data.replies.filter(r => r.status === "published").map(r => ({
      id: r.id,
      author: r.profiles?.username || "miembro",
      authorId: r.author_id,
      created: new Date(r.created_at).toLocaleDateString("es-AR"),
      body: r.body,
      isSpoiler: r.is_spoiler
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
          const { data: newTag, error: tagError } = await supabase.from("tags").insert({ name: tagName }).select("id").single();
          if (!tagError && newTag) {
            tagId = newTag.id;
          }
        }
        if (tagId) {
          await supabase.from("topic_tags").insert({ topic_id: data.id, tag_id: tagId });
        }
      } catch (err) {
        console.error("Error inserting tag:", tagName, err);
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

export async function createReport(payload) {
  if (!supabase) {
    console.log("Reporte simulado:", payload);
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
  const {data,error}=await supabase.from("problems").select("*,topics(id)").eq("id",id).single();
  if(error) throw error;
  return {id:data.id,number:data.number,title:data.title,statement:data.statement,source:data.source_url || "Archivo OAFForos",topicId:Array.isArray(data.topics) ? data.topics[0]?.id : data.topics?.id};
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
  if (!supabase) return { id: "problem-demo" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");

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
  if (!supabase) throw new Error("Configurá Supabase para enviar propuestas.");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Ingresá para enviar una propuesta.");
  const {error}=await supabase.from("archive_proposals").insert({author_id:user.id,proposal});
  if(error) throw error;
}

export async function getCurrentUserProfile() {
  if (!supabase) return { id: "demo-user", username: "miembro_demo", role: "admin" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) return null;
  return data;
}

export async function getArchiveProposals() {
  if (!supabase) return [];
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
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("archive_proposals")
    .update({ status, reviewer_note: note, reviewer_id: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getReports() {
  if (!supabase) return [];
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
  if (!supabase) return;
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


