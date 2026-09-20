// Command catalog: the single source of truth for every console command this UI offers.
//
// Data only: no I/O, no fetch, no spawn. The page renders it and copies the exact `command`
// text; nothing here is executed by the browser (the same rule as the /projects screen).
//
// Verified against the installed engram v2.0.0 (`engram --help`) and the scripts in
// package.json. Every command appears exactly once, in one group: scripts/check-commands.ts
// fails on a duplicated id or a repeated command text, and src/api/projects.ts derives its
// five Project commands from here through `commandText()`.

/** One copyable command, with what it does and when to reach for it. */
export interface CommandEntry {
  /** Stable key: unique across the whole catalog and used by `commandText()`. */
  id: string
  /** Exact text the copy button puts on the clipboard. */
  command: string
  /** Short name for the entry. */
  label: string
  /** What the command does, including its relevant flags. */
  description: string
  /** When and why to use it. */
  purpose: string
  /** Only when the command deletes or overwrites: shown as a warning, never as a claim of undo. */
  warning?: string
}

export interface CommandGroup {
  /** Anchor id for the group index at the top of the page. */
  id: string
  title: string
  intro: string
  entries: CommandEntry[]
}

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    id: 'runtime',
    title: 'Runtime de Engram',
    intro:
      'El runtime es el proceso que tiene la memoria. Esta interfaz habla con él por HTTP, así que estos comandos son el requisito previo de todo lo demás.',
    entries: [
      {
        id: 'serve',
        command: 'engram serve',
        label: 'Servidor HTTP local',
        description:
          'Levanta el API HTTP del runtime en el puerto 7437, que es el que consume esta interfaz. El puerto se puede cambiar con el primer argumento o con la variable ENGRAM_PORT.',
        purpose:
          'Es el requisito de la aplicación: sin un runtime escuchando en 7437, todas las pantallas responden con error de conexión.',
      },
      {
        id: 'serve-port',
        command: 'engram serve 7440',
        label: 'Servidor HTTP en otro puerto',
        description: 'Levanta el API HTTP en el puerto indicado en lugar del 7437.',
        purpose:
          'Para convivir con otro runtime que ya ocupa el 7437. Después hay que apuntar la aplicación al puerto nuevo con la variable ENGRAM_URL.',
      },
      {
        id: 'mcp-agent',
        command: 'engram mcp --tools=agent',
        label: 'MCP para agentes',
        description:
          'Arranca el servidor MCP por stdio con el perfil de agente (18 herramientas), que es lo que permite a un agente de IA leer y escribir la memoria.',
        purpose:
          'Es la superficie que usan los agentes. El bloque de configuración listo para copiar en tu agente lo imprime engram help.',
      },
      {
        id: 'mcp-admin',
        command: 'engram mcp --tools=admin',
        label: 'MCP de administración',
        description: 'Arranca el mismo servidor MCP con el perfil de administración (4 herramientas).',
        purpose:
          'Para tareas de mantenimiento desde un agente, sin exponerle el resto de herramientas.',
      },
      {
        id: 'tui',
        command: 'engram tui',
        label: 'Interfaz de terminal',
        description: 'Abre la interfaz interactiva de Engram en la terminal.',
        purpose:
          'Para revisar y editar la memoria sin navegador, o comprobar algo en la máquina donde corre el runtime.',
      },
      {
        id: 'doctor',
        command: 'engram doctor',
        label: 'Diagnóstico',
        description:
          'Diagnóstico operativo de solo lectura; acepta --json para salida legible por máquina, --project para acotar a un proyecto y --check para un chequeo concreto.',
        purpose:
          'Primer sitio donde mirar cuando la interfaz no conecta, no aparecen datos o algo parece inconsistente.',
      },
      {
        id: 'version',
        command: 'engram --version',
        label: 'Versión instalada',
        description: 'Imprime la versión del binario de Engram instalado en esta máquina.',
        purpose:
          'Para saber contra qué versión se verificó esta interfaz (v2.0.0) antes de atribuir un fallo a la pantalla.',
      },
      {
        id: 'test',
        command: 'engram test',
        label: 'Auto-test de fiabilidad',
        description:
          'Ejecuta los auto-test locales de fiabilidad y rendimiento en un entorno aislado; acepta una suite concreta (reliability o performance) y las opciones --quick y --json.',
        purpose: 'Para comprobar que la instalación local está sana sin tocar la memoria real.',
      },
      {
        id: 'init',
        command: 'engram init',
        label: 'Inicializar proyecto',
        description:
          'Escribe .engram/config.json en el directorio actual e inicializa el proyecto para esa carpeta; --force sobrescribe un fichero existente.',
        purpose:
          'Cuando quieres que el proyecto que detecta Engram sea el del directorio en el que trabajas, en lugar de depender de la detección por cwd.',
      },
      {
        id: 'setup',
        command: 'engram setup pi',
        label: 'Integración con un agente',
        description:
          'Instala la integración con un agente: acepta opencode, pi, claude-code, gemini-cli, codex, antigravity-cli, windsurf, qwen, kiro, cursor, vscode-copilot y kilocode.',
        purpose:
          'Una vez por agente y por máquina, para que ese agente tenga la memoria Engram disponible.',
      },
      {
        id: 'help',
        command: 'engram help',
        label: 'Ayuda del CLI',
        description:
          'Muestra la ayuda completa del CLI: todos los comandos, los perfiles MCP, las variables de entorno y el bloque de configuración del agente.',
        purpose:
          'Es la autoridad del catálogo de esta página: si un comando no aparece ahí, no existe.',
      },
    ],
  },
  {
    id: 'app',
    title: 'Esta aplicación (npm)',
    intro:
      'Los scripts del package.json de Engram Web: son la única vía de arranque de esta interfaz y de sus comprobaciones.',
    entries: [
      {
        id: 'npm-install',
        command: 'npm install',
        label: 'Instalar dependencias',
        description: 'Instala las dependencias del proyecto declaradas en package.json.',
        purpose: 'Una vez después de clonar el repositorio, y de nuevo cuando cambie package.json.',
      },
      {
        id: 'npm-dev',
        command: 'npm run dev',
        label: 'Desarrollo',
        description:
          'Servidor de desarrollo de Vite en http://127.0.0.1:5173, con /api/* reescrito hacia el runtime en 7437.',
        purpose: 'El modo de trabajo normal: recarga en caliente y sin build previo.',
      },
      {
        id: 'npm-build',
        command: 'npm run build',
        label: 'Build de producción',
        description:
          'Comprueba los tipos con vue-tsc y, si pasan, genera el build de producción en dist/.',
        purpose: 'Antes de servir la versión de producción, y como comprobación antes de dar por cerrado un cambio.',
      },
      {
        id: 'npm-start',
        command: 'npm start',
        label: 'Servidor de producción',
        description:
          'Servidor de producción en http://127.0.0.1:7438: sirve dist/ con fallback de SPA y hace de proxy de /api/* hacia el runtime.',
        purpose: 'Para usar la interfaz sin Vite. Requiere haber ejecutado antes npm run build.',
      },
      {
        id: 'npm-preview',
        command: 'npm run preview',
        label: 'Vista previa de Vite',
        description: 'Sirve el contenido de dist/ con el servidor de vista previa de Vite.',
        purpose:
          'Solo para mirar el build estático: no incluye el proxy de /api/* del servidor propio, así que las lecturas contra el runtime fallan.',
      },
      {
        id: 'npm-typecheck',
        command: 'npm run typecheck',
        label: 'Comprobación de tipos',
        description: 'Comprueba los tipos con vue-tsc sin emitir ningún archivo.',
        purpose: 'Después de tocar código TypeScript o componentes Vue, antes de cualquier otra comprobación.',
      },
      {
        id: 'npm-smoke',
        command: 'npm run smoke',
        label: 'Prueba de humo',
        description: 'Hace lecturas contra el runtime vivo en 7437 y no modifica nada.',
        purpose:
          'Primera verificación de extremo a extremo: necesita el runtime en marcha y comprueba que la interfaz y el runtime se entienden.',
      },
      {
        id: 'npm-check-writes',
        command: 'npm run check:writes',
        label: 'Comprobación de escrituras',
        description:
          'Intercepta fetch y revisa el método, la ruta y el cuerpo de cada mutación, sin usar la red.',
        purpose: 'Para verificar el camino de escritura sin tocar la memoria real.',
      },
      {
        id: 'npm-check-projects',
        command: 'npm run check:projects',
        label: 'Comprobación de proyectos',
        description:
          'Ejercita el inventario de proyectos sin red y sin lanzar procesos, contra un ciclo MCP capturado.',
        purpose: 'Después de tocar server/projects.mjs o el cliente de proyectos.',
      },
      {
        id: 'npm-check-server',
        command: 'npm run check:server',
        label: 'Comprobación del servidor',
        description:
          'Levanta el servidor de producción en un puerto efímero con un runtime de mentira y comprueba el proxy /api/*, el fallback de la SPA y /local/projects.',
        purpose: 'Después de tocar server/server.mjs o el enrutado del servidor.',
      },
      {
        id: 'npm-check-commands',
        command: 'npm run check:commands',
        label: 'Comprobación del catálogo',
        description:
          'Comprueba este catálogo sin red y sin procesos: identificadores únicos, textos no vacíos y ningún comando repetido en dos grupos.',
        purpose: 'Después de añadir o editar un comando en src/api/commands.ts.',
      },
    ],
  },
  {
    id: 'read',
    title: 'Consulta y lectura',
    intro: 'Lecturas de la memoria desde consola. Ninguna de estas órdenes escribe nada.',
    entries: [
      {
        id: 'search',
        command: 'engram search "texto a buscar"',
        label: 'Buscar memorias',
        description:
          'Busca en las observaciones; acepta --type, --project o --all, --scope, --limit y --match all o any.',
        purpose: 'Búsqueda rápida en consola, con los mismos filtros que la pantalla Búsqueda.',
      },
      {
        id: 'context',
        command: 'engram context',
        label: 'Contexto reciente',
        description:
          'Muestra el contexto reciente de sesiones anteriores; acepta un proyecto como argumento, --project o --all y --scope.',
        purpose: 'Para retomar un trabajo: es la lectura que alimenta la pantalla Sesiones.',
      },
      {
        id: 'timeline',
        command: 'engram timeline 123',
        label: 'Cronología',
        description:
          'Muestra el contexto cronológico alrededor de una observación, con --before y --after para ampliar la ventana.',
        purpose: 'Para entender qué se estaba haciendo antes y después de una memoria concreta.',
      },
      {
        id: 'stats',
        command: 'engram stats',
        label: 'Estadísticas',
        description: 'Muestra las estadísticas del sistema de memoria; con --all agrega todos los proyectos.',
        purpose: 'Para ver los totales de sesiones, observaciones y prompts sin abrir el navegador.',
      },
      {
        id: 'projects-list',
        command: 'engram projects list',
        label: 'Listar proyectos',
        description:
          'Lista todos los proyectos con sus conteos de observaciones, sesiones y prompts.',
        purpose: 'Es la misma consulta que alimenta la tabla de la pantalla Proyectos.',
      },
      {
        id: 'conflicts-list',
        command: 'engram conflicts list',
        label: 'Listar conflictos',
        description:
          'Lista las relaciones de conflicto; acepta --project, --status, --since y --limit.',
        purpose: 'Revisión de conflictos en consola, equivalente al listado de la pantalla Conflictos.',
      },
      {
        id: 'conflicts-show',
        command: 'engram conflicts show 45',
        label: 'Detalle de un conflicto',
        description: 'Muestra el detalle de una relación de conflicto por su identificador.',
        purpose: 'Para leer las dos memorias enfrentadas antes de decidir un veredicto.',
      },
      {
        id: 'conflicts-stats',
        command: 'engram conflicts stats',
        label: 'Estadísticas de conflictos',
        description: 'Resume los conflictos por estado; se puede acotar con --project.',
        purpose: 'Para saber cuánto trabajo pendiente hay antes de sentarte a resolver conflictos.',
      },
    ],
  },
  {
    id: 'write',
    title: 'Escritura y mantenimiento',
    intro:
      'Órdenes que modifican la memoria. Las marcadas como destructivas no tienen vuelta atrás: el runtime no expone ninguna ruta de restauración.',
    entries: [
      {
        id: 'save',
        command: 'engram save "Título" "Contenido"',
        label: 'Guardar una memoria',
        description: 'Guarda una observación con título y contenido; acepta --type, --project y --scope.',
        purpose: 'Alta manual desde consola, igual que la pantalla Nueva memoria.',
      },
      {
        id: 'delete-obs',
        command: 'engram delete 123',
        label: 'Borrado suave de una observación',
        description:
          'Marca la observación como borrada: la fila permanece en la base, pero desaparece de todos los listados.',
        purpose: 'Para retirar una memoria sin eliminarla de la base.',
        warning:
          'Aunque la fila siga en la base, el runtime no expone ninguna ruta de restauración: en la práctica no se puede recuperar ni desde el CLI ni desde el API.',
      },
      {
        id: 'delete-obs-hard',
        command: 'engram delete 123 --hard',
        label: 'Borrado permanente de una observación',
        description: 'Elimina la observación de la base de datos de forma permanente.',
        purpose: 'Solo cuando estás seguro de que la memoria no vuelve a hacer falta.',
        warning: 'No hay vuelta atrás: no existe restauración en el runtime.',
      },
      {
        id: 'delete-session',
        command: 'engram delete session 12',
        label: 'Borrar una sesión',
        description: 'Borra una sesión por identificador; el runtime la rechaza si todavía tiene observaciones.',
        purpose: 'Para limpiar sesiones vacías que ya no aportan contexto.',
      },
      {
        id: 'delete-prompt',
        command: 'engram delete prompt 7',
        label: 'Borrar un prompt',
        description: 'Borra un prompt por identificador de forma permanente.',
        purpose: 'Para limpiar prompts guardados por agentes que no aportan nada.',
        warning: 'No hay vuelta atrás.',
      },
      {
        id: 'delete-project',
        command: 'engram delete project "nombre"',
        label: 'Borrar un proyecto en cascada',
        description:
          'Borra en cascada un proyecto entero: borrado suave de sus observaciones (permanente con --hard), eliminación de sus prompts y, con --hard, también de sus sesiones.',
        purpose: 'Para deshacerse de un proyecto completo de una sola vez.',
        warning:
          'Es la orden más destructiva del CLI: con --hard no queda nada de ese proyecto y no hay restauración.',
      },
      {
        id: 'projects-prune-dry-run',
        command: 'engram projects prune --dry-run',
        label: 'Poda: simulación',
        description: 'Lista los proyectos que se podarían, sin borrar nada.',
        purpose: 'Paso previo obligatorio antes de la poda real.',
      },
      {
        id: 'projects-prune',
        command: 'engram projects prune',
        label: 'Poda: real',
        description:
          'Elimina los proyectos que no tienen observaciones, junto con sus prompts y sus sesiones vacías. Es interactiva: eliges los números de la lista. Se niega a podar un proyecto que todavía tenga observaciones.',
        purpose: 'Para limpiar nombres de proyecto huérfanos, por ejemplo los que llevan ruta en el nombre.',
        warning: 'No hay vuelta atrás: el runtime no expone ninguna restauración.',
      },
      {
        id: 'projects-prune-paths-only',
        command: 'engram projects prune --paths-only',
        label: 'Poda: solo nombres con ruta',
        description: 'Limita la poda a los nombres de proyecto que contienen / o \\, que el API HTTP no puede consultar.',
        purpose: 'La variante conservadora cuando solo quieres quitar nombres con ruta.',
        warning: 'Borra igual que la poda real; --dry-run primero.',
      },
      {
        id: 'projects-consolidate-dry-run',
        command: 'engram projects consolidate --all --dry-run',
        label: 'Consolidación: simulación',
        description: 'Muestra qué grupos de nombres similares fusionaría el almacén, sin cambiar nada.',
        purpose: 'Para saber si hay algo que fusionar antes de tocar nada.',
      },
      {
        id: 'projects-consolidate',
        command: 'engram projects consolidate --all',
        label: 'Consolidación: real',
        description:
          'Fusiona los grupos de nombres que canonizan al mismo proyecto (minúsculas y colapso de -- y __). Cualquier otro par lo rechaza el propio almacén.',
        purpose:
          'Para unir duplicados reales del mismo proyecto. Los nombres con ruta no se pueden fusionar: normalizan a nombres distintos y hay que mover sus observaciones una a una.',
        warning: 'Fusiona proyectos de verdad, sin deshacer.',
      },
      {
        id: 'conflicts-scan-dry-run',
        command: 'engram conflicts scan --dry-run',
        label: 'Detección de conflictos',
        description:
          'Busca posibles relaciones de conflicto sin escribir nada; acepta --project, --since, --limit, --cursor, --max-insert y --semantic, que usa el runner indicado por ENGRAM_AGENT_CLI.',
        purpose: 'Para ver qué conflictos detectaría el escaneo antes de aplicarlos.',
      },
      {
        id: 'conflicts-scan-apply',
        command: 'engram conflicts scan --apply',
        label: 'Aplicar los conflictos detectados',
        description:
          'Inserta las relaciones de conflicto que encuentra el escaneo, con --max-insert para acotar; --yes evita la confirmación interactiva.',
        purpose: 'Para poblar la cola de conflictos que muestra la pantalla Conflictos.',
      },
      {
        id: 'conflicts-deferred',
        command: 'engram conflicts deferred',
        label: 'Conflictos diferidos',
        description:
          'Lista los conflictos que el escaneo semántico dejó en espera; acepta --status, --limit, --inspect para ver uno y --replay para reintentarlo.',
        purpose: 'Para reintentar la parte del escaneo semántico que no se pudo resolver.',
      },
      {
        id: 'export',
        command: 'engram export',
        label: 'Exportar a JSON',
        description:
          'Exporta las memorias a JSON (engram-export.json por defecto); acepta otro nombre de archivo, --project o --all.',
        purpose: 'Copia de seguridad puntual o material para mover la memoria a otra máquina.',
      },
      {
        id: 'import',
        command: 'engram import engram-export.json',
        label: 'Importar desde JSON',
        description: 'Importa memorias desde un archivo JSON exportado previamente.',
        purpose: 'Para restaurar un export o mover memoria entre máquinas.',
        warning: 'Escribe en el almacén: revisa el archivo antes de lanzarlo, porque no hay deshacer.',
      },
    ],
  },
  {
    id: 'sync',
    title: 'Sincronización y exportación',
    intro:
      'Traslado de la memoria por archivos, sin nube. Los bloques quedan en la carpeta .engram/ del directorio de trabajo.',
    entries: [
      {
        id: 'sync',
        command: 'engram sync',
        label: 'Exportar bloques nuevos',
        description: 'Exporta las memorias nuevas como un bloque comprimido dentro de .engram/.',
        purpose: 'Para llevarte la memoria por archivos cuando no puedes o no quieres usar la nube.',
      },
      {
        id: 'sync-import',
        command: 'engram sync --import',
        label: 'Importar bloques nuevos',
        description: 'Importa a la base local los bloques nuevos que encuentre en .engram/.',
        purpose: 'El otro extremo de engram sync, en la máquina de destino.',
      },
      {
        id: 'sync-status',
        command: 'engram sync --status',
        label: 'Estado de sincronización',
        description: 'Muestra el estado de sincronización.',
        purpose: 'Para comprobar qué falta por exportar o importar antes de mover archivos.',
      },
      {
        id: 'sync-all',
        command: 'engram sync --all',
        label: 'Exportar todos los proyectos',
        description: 'Exporta todos los proyectos, ignorando el filtro por directorio de trabajo.',
        purpose: 'Cuando quieres un bloque completo en lugar del del proyecto actual.',
      },
      {
        id: 'sync-cloud',
        command: 'engram sync --cloud --project "nombre"',
        label: 'Sincronizar con la nube',
        description:
          'Ejecuta la sincronización contra el servidor de nube configurado; exige un proyecto explícito.',
        purpose: 'Solo para proyectos inscritos con engram cloud enroll.',
      },
      {
        id: 'obsidian-export',
        command: 'engram obsidian-export --vault "ruta/al/vault"',
        label: 'Exportar a Obsidian',
        description:
          'Exporta las memorias como vault de markdown compatible con Obsidian. La ruta del vault es obligatoria y acepta --project o --all, --limit, --since, --force, --graph-config, --watch e --interval.',
        purpose: 'Para leer la memoria como notas en Obsidian, o mantener el vault sincronizado con --watch.',
      },
    ],
  },
  {
    id: 'cloud',
    title: 'Nube (opcional)',
    intro:
      'Integración con un servidor de nube, explícitamente opt-in. La memoria local funciona sin nada de esto.',
    entries: [
      {
        id: 'cloud-status',
        command: 'engram cloud status',
        label: 'Estado de la nube',
        description: 'Muestra la configuración de la nube: URL del servidor y estado de la inscripción.',
        purpose: 'Primer comando si dudas de si este equipo está o no sincronizando con la nube.',
      },
      {
        id: 'cloud-config',
        command: 'engram cloud config',
        label: 'Configurar el servidor',
        description: 'Fija la URL del servidor de nube que usan la inscripción y la sincronización.',
        purpose: 'Una vez por equipo, antes de inscribir ningún proyecto.',
      },
      {
        id: 'cloud-enroll',
        command: 'engram cloud enroll',
        label: 'Inscribir un proyecto',
        description: 'Inscribe un proyecto para sincronización en la nube.',
        purpose: 'Por proyecto y a propósito: solo los inscritos salen de la máquina.',
      },
      {
        id: 'cloud-serve',
        command: 'engram cloud serve',
        label: 'Servidor de nube propio',
        description:
          'Levanta el backend de nube y su panel. Necesita Postgres (ENGRAM_DATABASE_URL) y las variables de autenticación y de listas de proyectos permitidos.',
        purpose: 'Para operar tu propio servidor de sincronización; no hace falta para usar la memoria local.',
      },
    ],
  },
]

/** Flat index of every entry, keyed by id. */
export const COMMANDS_BY_ID: ReadonlyMap<string, CommandEntry> = new Map(
  COMMAND_GROUPS.flatMap((group) => group.entries.map((entry) => [entry.id, entry] as const)),
)

/** Total number of catalogued commands, shown in the page header. */
export const COMMAND_COUNT = COMMANDS_BY_ID.size

/**
 * Exact text of one entry. Throws on an unknown id instead of returning undefined: a typo must
 * fail loudly, never render or copy an empty command.
 */
export function commandText(id: string): string {
  const entry = COMMANDS_BY_ID.get(id)
  if (!entry) throw new Error(`unknown command id: ${id}`)
  return entry.command
}

/** Shape of the catalog filters, shared by the shell bar and the /commands view. */
export interface CommandFilter {
  /** Empty string means "every group". */
  group: string
  /** Free text matched against command, label, description and purpose. */
  query: string
}

/** Accent- and case-insensitive fold: "busqueda" must find "Búsqueda". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** The query searches every text an entry shows, so the description is searchable too. */
function matches(entry: CommandEntry, needle: string): boolean {
  if (!needle) return true
  const haystack = [entry.command, entry.label, entry.description, entry.purpose].join(' ')
  return fold(haystack).includes(needle)
}

/** Only the groups that still have a match survive, so an empty group never renders. */
export function filterCommandGroups(filter: CommandFilter): CommandGroup[] {
  const needle = fold(filter.query.trim())
  return COMMAND_GROUPS.filter((group) => filter.group === '' || group.id === filter.group)
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => matches(entry, needle)) }))
    .filter((group) => group.entries.length > 0)
}

/** Entries the current filters keep visible, for the bar's counter. */
export function countCommands(filter: CommandFilter): number {
  return filterCommandGroups(filter).reduce((total, group) => total + group.entries.length, 0)
}
