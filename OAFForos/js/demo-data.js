export const demo = {
  categories: [
    { id: "mecanica", icon: "↗", title: "Mecánica", description: "Movimiento, fuerzas, conservación y sistemas." },
    { id: "electromagnetismo", icon: "ϟ", title: "Electromagnetismo", description: "Campos, circuitos, inducción y ondas electromagnéticas." },
    { id: "termodinamica", icon: "◌", title: "Termodinámica", description: "Equilibrio, procesos, máquinas y estadística." },
    { id: "ondas", icon: "≈", title: "Ondas y óptica", description: "Oscilaciones, interferencia, óptica geométrica y física." },
    { id: "moderna", icon: "◈", title: "Física moderna", description: "Relatividad, cuántica, nuclear y partículas." },
    { id: "comunidad", icon: "○", title: "Comunidad", description: "Presentaciones, recursos y conversación entre olímpicos." }
  ],
  topics: [
    { id: "bloque-plano-inclinado", category: "mecanica", title: "¿Cómo encarar este bloque sobre un plano inclinado?", author: "sofia_fernandez", created: "hace 2 h", replies: 4, tags: ["dinámica", "OAF 2024"], body: "Estoy intentando resolver el problema 3 de nivel 2. Entiendo que debo proyectar las fuerzas, pero no sé cómo tratar la tensión cuando el bloque empieza a moverse.", responses: [{author:"mateo_phys",created:"hace 1 h",body:"Primero fijá un sistema de ejes paralelo y perpendicular al plano. La condición normal te permite encontrar la fuerza de rozamiento; recién después planteá la segunda ley sobre el eje paralelo."}] },
    { id: "oscilador-amortiguado", category: "ondas", title: "Intuición para el oscilador amortiguado", author: "lucas_r", created: "ayer", replies: 7, tags: ["oscilaciones", "teoría"], body: "Busco una explicación física de por qué la frecuencia cambia al añadir rozamiento viscoso.", responses: [] },
    { id: "campo-anillo", category: "electromagnetismo", title: "Campo eléctrico sobre el eje de un anillo cargado", author: "vale", created: "hace 3 días", replies: 2, tags: ["electrostática", "integrales"], body: "¿Hay una manera limpia de justificar por simetría que solo queda la componente axial?", responses: [] }
  ],
  archive: [
    { id:"oaf", type:"Olimpíadas nacionales", title:"Olimpíada Argentina de Física", description:"Problemas oficiales de las instancias nacionales." },
    { id:"ibero", type:"Olimpíadas internacionales", title:"Olimpíada Iberoamericana de Física", description:"Archivo histórico de la OIbF." },
    { id:"ipho", type:"Olimpíadas internacionales", title:"International Physics Olympiad", description:"Problemas y resultados de la IPhO." },
    { id:"universitarias", type:"Universitarias", title:"Competencias universitarias", description:"Torneos y exámenes abiertos de nivel universitario." }
  ],
  editions: [{id:"oaf-2024", competition:"oaf", title:"Edición 2024", description:"Instancia nacional"},{id:"oaf-2023",competition:"oaf",title:"Edición 2023",description:"Instancia nacional"}],
  levels: [{id:"oaf-2024-n1",edition:"oaf-2024",title:"Nivel 1"},{id:"oaf-2024-n2",edition:"oaf-2024",title:"Nivel 2"}],
  problems: [{id:"problema-demo",level:"oaf-2024-n2",number:3,kind:"theoretical",title:"El bloque y la polea",statement:"Un bloque de masa $m$ se encuentra sobre un plano inclinado de ángulo $\\theta$ y está unido mediante una cuerda ideal a una masa colgante. Determinar la condición para que el sistema permanezca en reposo.",source:"OAF 2024 · Nivel 2",topicId:"bloque-plano-inclinado"}]
};
