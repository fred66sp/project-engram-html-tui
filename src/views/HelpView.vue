<!--
  Help page: static copy plus one read-only probe of the runtime (its version). Every claim below
  is checkable against the code, the upstream docs of the installed Engram, or the feature
  documents in odd/tasks/.
-->
<template>
  <div class="help">
    <h1>Ayuda</h1>

    <nav class="help-toc" aria-label="Contenido de la ayuda">
      <strong>Contenido</strong>
      <ul>
        <li><a href="#que-es">Qué es esta aplicación</a></li>
        <li><a href="#engram">Qué es Engram</a></li>
        <li><a href="#conexion">Cómo se conecta</a></li>
        <li><a href="#arranque">Cómo arrancarla</a></li>
        <li><a href="#pantallas">Las pantallas</a></li>
        <li><a href="#proyectos">Proyectos</a></li>
        <li><a href="#vocabulario">Vocabulario y filtros</a></li>
        <li><a href="#escrituras">Qué hace cada acción de escritura</a></li>
        <li><a href="#limitaciones">Limitaciones conocidas</a></li>
        <li><a href="#avisos">Avisos de lectura</a></li>
      </ul>
    </nav>

    <section id="que-es" class="help-section">
      <h2>Qué es esta aplicación</h2>
      <p>
        Engram Web es una interfaz web sobre el runtime local de memoria Engram
        (<code>engram serve</code>, API JSON en <code>http://127.0.0.1:7437</code>).
      </p>
      <p>
        No es un servicio remoto ni una copia: lee y escribe la misma base de datos que usan el CLI
        y los agentes de Engram. Lo que ves en pantalla es tu memoria real, y lo que escribes desde
        aquí queda en ella.
      </p>
    </section>

    <section id="engram" class="help-section">
      <h2>Qué es Engram</h2>
      <p>
        Engram es la memoria de la que vive esta interfaz. Es un proyecto de código abierto bajo
        licencia MIT, publicado en
        <a href="https://github.com/Gentleman-Programming/engram">github.com/Gentleman-Programming/engram</a>,
        y sus autores lo describen como memoria persistente para agentes de programación con IA:
        agnóstico del agente, un solo binario de Go y sin dependencias. Su sitio es
        <a href="https://engram.gentlemanprogramming.com/">engram.gentlemanprogramming.com</a>.
      </p>
      <p>
        Cada agente decide qué merece recordarse: no hay recolección masiva ni automática de
        llamadas a herramientas. El agente guarda observaciones estructuradas (título, tipo,
        contenido) cuando termina algo significativo y, al cerrar la sesión, suele escribir un
        resumen.
      </p>

      <h3>Cómo funciona</h3>
      <p>
        Los datos viven en SQLite con índice de texto completo FTS5, en
        <code>~/.engram/engram.db</code> de esta máquina; al lado hay una carpeta
        <code>backups</code>.
      </p>
      <p>
        El vocabulario del almacén es: sesiones, observaciones, prompts y relaciones entre
        observaciones. Los conflictos se detectan por relaciones y se resuelven con un veredicto, y
        las observaciones entran en una cola de revisión cuando su fecha de revisión vence.
      </p>
      <p>
        Engram expone cuatro superficies: servidor MCP por stdio (lo que usan los agentes), API HTTP
        local en el puerto 7437, línea de comandos e interfaz de terminal. Existe además un runtime
        en la nube opcional, con sincronización solo para los proyectos que se inscriben en él; la
        memoria local funciona sin nube.
      </p>
      <p class="help-note">
        Esta aplicación web <strong>no forma parte del proyecto</strong>: es una interfaz local e
        independiente que habla con el API HTTP del runtime instalado. Nunca escribe el fichero de
        la base, todo pasa por ese API. Se desarrolló y verificó contra la versión v2.0.0, así que
        si el proyecto cambia ese API, esta interfaz puede necesitar ajustes. Dicho de otro modo:
        Engram y su documentación los mantiene el proyecto upstream; esta interfaz se mantiene
        aparte.
      </p>

      <h3>Cómo se mantiene</h3>
      <p>
        El repositorio upstream es la fuente de verdad y tiene documentación propia: <code>DOCS.md</code>,
        <code>docs/ARCHITECTURE.md</code>, <code>docs/INSTALLATION.md</code> y
        <code>docs/RELEASE-POLICY.md</code>.
      </p>
      <p>
        Su política de publicación define tres canales:
      </p>
      <ul>
        <li>La última versión estable: la recomendada, y la que recibe correcciones de seguridad.</li>
        <li>Las candidatas a versión (prerelease): para validación, sin soporte de seguridad garantizado.</li>
        <li>Las versiones antiguas: sin correcciones de seguridad.</li>
      </ul>
      <p>
        Actualizar es una decisión deliberada: elegir canal, leer las notas de la versión y sus
        migraciones, <strong>hacer copia de seguridad del estado</strong> antes de tocar nada,
        validar el entorno y conservar una instalación buena conocida hasta aceptar la nueva. La
        política no promete un camino de vuelta automático: revertir significa restaurar la versión
        y la copia de seguridad conocidas.
      </p>
      <p>
        En esta máquina, <code>engram --version</code> dice qué versión está instalada y
        <code>engram doctor</code> comprueba su estado con un diagnóstico de solo lectura.
      </p>
      <p v-if="runtimeReachable === true" class="help-note">
        Runtime detectado: <code>engram v{{ runtimeVersion }}</code>.
      </p>
      <p v-else-if="runtimeReachable === false" class="help-note help-note-warn">
        El runtime no está accesible en este momento, así que esta sección describe la instalación
        prevista de Engram, no un estado en vivo. El chip de estado de la cabecera y el botón
        «Reintentar» muestran la respuesta real.
      </p>
      <p v-else class="help-note">Comprobando la versión del runtime…</p>
    </section>

    <section id="conexion" class="help-section">
      <h2>Cómo se conecta</h2>
      <ul>
        <li>El runtime de Engram escucha en <code>http://127.0.0.1:7437</code>.</li>
        <li>
          La aplicación nunca llama al runtime entre orígenes: ese API no envía cabeceras CORS y
          responde <code>405</code> a las peticiones <code>OPTIONS</code>, así que el navegador no
          puede invocarlo de forma directa.
        </li>
        <li>
          Todas las peticiones salen hacia <code>/api/*</code> en el mismo origen y las reescribe
          hacia el runtime el servidor propio: Vite en desarrollo, <code>server/server.mjs</code> en
          producción.
        </li>
        <li>
          El proxy añade la cabecera <code>Authorization: Bearer</code> cuando existe
          <code>ENGRAM_HTTP_TOKEN</code>.
        </li>
        <li>
          La única excepción es <code>/local/projects</code>, el inventario de proyectos: no es una
          reescritura sino una ruta que responde el servidor propio en su mismo proceso, sin pasar
          por el runtime. Se detalla en <a href="#proyectos">Proyectos</a>.
        </li>
      </ul>
    </section>

    <section id="arranque" class="help-section">
      <h2>Cómo arrancarla</h2>
      <table class="checks">
        <thead>
          <tr>
            <th scope="col">Comando</th>
            <th scope="col">Qué hace</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>npm install</code></td>
            <td>Instala las dependencias del proyecto.</td>
          </tr>
          <tr>
            <td><code>npm run dev</code></td>
            <td>
              Servidor de desarrollo en <code>http://127.0.0.1:5173</code>, con
              <code>/api/*</code> reescrito hacia el runtime.
            </td>
          </tr>
          <tr>
            <td><code>npm run build</code></td>
            <td>Comprobación de tipos y build de producción en <code>dist/</code>.</td>
          </tr>
          <tr>
            <td><code>npm start</code></td>
            <td>
              Servidor de producción en <code>http://127.0.0.1:7438</code>: sirve
              <code>dist/</code> con fallback de SPA y hace de proxy de <code>/api/*</code>.
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Variables de entorno</h3>
      <table class="checks">
        <thead>
          <tr>
            <th scope="col">Variable</th>
            <th scope="col">Por defecto</th>
            <th scope="col">Para qué sirve</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>PORT</code></td>
            <td><code>7438</code></td>
            <td>Puerto del servidor de producción.</td>
          </tr>
          <tr>
            <td><code>ENGRAM_URL</code></td>
            <td><code>http://127.0.0.1:7437</code></td>
            <td>URL base del runtime. La leen el proxy de desarrollo y el de producción.</td>
          </tr>
          <tr>
            <td><code>ENGRAM_HTTP_TOKEN</code></td>
            <td>vacío</td>
            <td>Token Bearer para rutas protegidas; sin él el runtime queda abierto.</td>
          </tr>
        </tbody>
      </table>

      <h3>Comprobaciones</h3>
      <ul>
        <li><code>npm run typecheck</code>: comprueba los tipos con <code>vue-tsc</code> sin emitir.</li>
        <li>
          <code>npm run smoke</code>: hace lecturas contra el runtime vivo en 7437 y no modifica nada.
        </li>
        <li>
          <code>npm run check:writes</code>: intercepta <code>fetch</code> y comprueba el método,
          la ruta y el cuerpo de cada mutación sin usar la red, para probar el camino de escritura
          sin tocar la memoria real.
        </li>
        <li>
          <code>npm run check:projects</code>: ejercita el inventario de proyectos sin red y sin
          lanzar ningún proceso; parsea un ciclo MCP capturado e intercepta <code>fetch</code> para
          revisar la llamada del cliente.
        </li>
        <li><code>npm run build</code>: comprobación de tipos más build de producción.</li>
      </ul>
    </section>

    <section id="pantallas" class="help-section">
      <h2>Las pantallas</h2>
      <table class="checks">
        <thead>
          <tr>
            <th scope="col">Pantalla</th>
            <th scope="col">Ruta</th>
            <th scope="col">Qué hace</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dashboard</td>
            <td><code>/</code></td>
            <td>
              Totales globales (sesiones, observaciones, prompts, proyectos), lista de proyectos
              para filtrar Recientes, diagnóstico <code>/doctor</code> del proyecto seleccionado y
              descarga del export.
            </td>
          </tr>
          <tr>
            <td>Recientes</td>
            <td><code>/recent</code></td>
            <td>
              Últimas observaciones con límite configurable; el filtro por tipo se aplica en el
              navegador sobre la página cargada.
            </td>
          </tr>
          <tr>
            <td>Búsqueda</td>
            <td><code>/search</code></td>
            <td>
              Consulta de texto con tipo, scope, modo de coincidencia y límite; filtra el runtime y
              muestra la puntuación de cada resultado.
            </td>
          </tr>
          <tr>
            <td>Detalle de observación</td>
            <td><code>/observations/:id</code></td>
            <td>
              Contenido en markdown saneado, metadatos y las escrituras controladas: pin, edición,
              marcar revisada y eliminar. Enlaza al timeline.
            </td>
          </tr>
          <tr>
            <td>Timeline</td>
            <td><code>/timeline/:id</code></td>
            <td>
              Observación focal con sus vecinas anteriores y posteriores, más los metadatos de su
              sesión.
            </td>
          </tr>
          <tr>
            <td>Sesiones</td>
            <td><code>/sessions</code></td>
            <td>
              Sesiones recientes con sus metadatos, y prompts (los más recientes o el resultado de
              una búsqueda de texto).
            </td>
          </tr>
          <tr>
            <td>Review</td>
            <td><code>/review</code></td>
            <td>
              Cola de observaciones pendientes de revisión, con la acción «Marcar revisada» por fila.
            </td>
          </tr>
          <tr>
            <td>Conflictos</td>
            <td><code>/conflicts</code></td>
            <td>
              Estadísticas y listado paginado de relaciones de conflicto, con formulario de
              veredicto por fila.
            </td>
          </tr>
          <tr>
            <td>Nueva memoria</td>
            <td><code>/new</code></td>
            <td>
              Alta de una observación reutilizando la sesión manual
              <code>manual-save-&lt;proyecto&gt;</code>, igual que <code>engram save</code>.
            </td>
          </tr>
          <tr>
            <td>Proyectos</td>
            <td><code>/projects</code></td>
            <td>
              Inventario del almacén con conteos y directorios, marca de los proyectos podables y
              de los nombres con ruta, y los comandos de poda y consolidación para copiar. Solo lee.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="proyectos" class="help-section">
      <h2>Proyectos</h2>
      <p>
        <code>/projects</code> muestra el inventario del almacén: cada proyecto con sus conteos
        (observaciones, sesiones y prompts) y los directorios asociados. Es la pantalla de la higiene
        de nombres, que el resto de la interfaz no puede ver. <strong>Solo lee</strong>: no ejecuta
        ninguna orden, y su única interacción es copiar un comando al portapapeles.
      </p>

      <h3>Por qué existe</h3>
      <p>
        El API HTTP del runtime no ofrece gestión de proyectos, y además rechaza los nombres con
        ruta —justo los que la poda tiene que limpiar— con <code>400 invalid_project</code> («project
        must be a name, not a path»). El selector de proyecto de la barra superior se llena desde
        <code>/stats?all_projects=true</code>, que devuelve nombres sueltos <strong>sin conteos</strong>
        y omite únicamente los proyectos sin observaciones. Un nombre con ruta sí aparece ahí si tiene
        observaciones, aunque después no se pueda consultar, y los podables no aparecen nunca. Sin
        esta pantalla, esa higiene de nombres es invisible desde el navegador.
      </p>
      <p>
        Por eso sus datos no salen del API HTTP: los responde el servidor propio en
        <code>/local/projects</code>, con un único ciclo
        <code>engram mcp --tools=mem_list_projects</code> por stdio. Es la única ruta que
        <strong>no</strong> es una reescritura hacia el runtime, y se apoya en la misma consulta que
        <code>engram projects list</code>, así que la pantalla y el CLI no divergen.
      </p>
      <p>
        Dos variables la configuran: <code>ENGRAM_BIN</code> (por defecto <code>engram</code>) elige
        el binario, y <code>ENGRAM_MCP_TIMEOUT_MS</code> (por defecto <code>10000</code>) fija el
        tiempo máximo del ciclo. El proceso recibe argumentos fijos y ningún dato llegado del
        navegador; si el binario no está, la pantalla responde un error legible, nunca un inventario
        vacío.
      </p>

      <h3>Qué marca la tabla</h3>
      <ul>
        <li>
          <strong>sin observaciones · podable</strong>: el proyecto no tiene ninguna observación, que
          es la única condición que el runtime acepta para podarlo.
        </li>
        <li>
          <strong>nombre con ruta · no consultable por HTTP</strong>: su nombre lleva ruta
          (<code>/</code>, <code>\</code> o <code>:</code>), así que el API HTTP lo rechaza con
          <code>400 invalid_project</code>. Puede aparecer en la lista de nombres de
          <code>/stats?all_projects=true</code> si tiene observaciones, pero no se puede consultar por
          HTTP. Solo se puede consultar aquí.
        </li>
      </ul>

      <h3>Qué hace realmente la poda</h3>
      <p class="help-note help-note-warn">
        <code>engram projects prune</code> <strong>borra de verdad</strong> los prompts del proyecto y
        sus sesiones sin observaciones, y <strong>no tiene vuelta atrás</strong>: el runtime no expone
        ninguna restauración. Además se niega a podar un proyecto al que le queden observaciones
        (<code>… still has N observations — cannot prune</code>), así que solo entran los proyectos
        marcados como podables. La poda real es interactiva y <code>--dry-run</code> solo lista, no
        borra.
      </p>
      <p>
        La pantalla ofrece el comando con su botón de copia, pero no lo ejecuta: la decisión de esta
        interfaz es no añadir superficie destructiva nueva en el navegador. Se copia y se lanza en una
        terminal, a mano.
      </p>

      <h3>El límite de la consolidación</h3>
      <p>
        <code>engram projects consolidate</code> solo fusiona nombres que canonizan al mismo nombre:
        minúsculas y colapso de <code>--</code> y <code>__</code>. Cualquier otra cosa el propio
        almacén la rechaza con
        <code>source project "…" must normalize to canonical project "…"</code>. Por eso
        <code>c:/docker-curso</code> y <code>docker-curso</code>
        <strong>no se pueden fusionar</strong>: normalizan a nombres distintos.
      </p>
      <p>
        Para esos casos el camino es manual: mover las observaciones al proyecto correcto desde el
        detalle de cada observación (el campo <code>project</code> es editable) y después podar el
        nombre que quede con cero observaciones. La pantalla no propone fusiones ni marca
        equivalencias: la autoridad es el comando y su <code>--dry-run</code>.
      </p>
    </section>

    <section id="vocabulario" class="help-section">
      <h2>Vocabulario y filtros</h2>

      <h3>Proyecto</h3>
      <p>
        Para el runtime, el proyecto se resuelve en este orden: el parámetro <code>project</code>
        explícito, luego la variable <code>ENGRAM_PROJECT</code>, y si no hay ninguno de los dos, el
        <strong>directorio de trabajo del proceso servidor</strong>. Ese último caso es el peligroso,
        así que la interfaz siempre envía un proyecto explícito o <code>all_projects</code>, nunca
        ambos.
      </p>

      <h3>Scope</h3>
      <p>
        Los valores de scope que maneja la aplicación son <code>project</code>, <code>personal</code>
        y <code>global</code>. El selector de scope acepta además el valor vacío, que significa
        «cualquiera».
      </p>

      <h3>Filtro por tipo</h3>
      <p>
        En <strong>Recientes</strong> el filtro por tipo se aplica en el navegador sobre la página ya
        cargada, porque los endpoints de listado del runtime no aceptan <code>type</code>. En
        <strong>Búsqueda</strong> el tipo sí lo filtra el runtime.
      </p>

      <h3>match_mode</h3>
      <p>
        En la búsqueda, <code>all</code> exige que estén todas las palabras de la consulta;
        <code>any</code> se conforma con que aparezca cualquiera de ellas.
      </p>

      <h3>El número de los resultados de búsqueda</h3>
      <p>
        Es la puntuación del índice de texto que devuelve el runtime (<code>rank</code>), no un
        porcentaje. El runtime entrega los resultados ordenados por relevancia, de mejor a peor.
      </p>
    </section>

    <section id="escrituras" class="help-section">
      <h2>Qué hace cada acción de escritura</h2>

      <h3>Fijar / quitar pin</h3>
      <p>
        El runtime guarda el pin, pero <strong>no lo devuelve al leer</strong> una observación: tras
        recargar la página, el botón vuelve a mostrar «Fijar» aunque la observación siga fijada. El
        estado que ves justo después de pulsar es la respuesta del momento, no una confirmación
        posterior.
      </p>

      <h3>Editar campos</h3>
      <p>
        El formulario muestra primero el resumen «antes → después» y envía en el
        <code>PATCH</code> solo los campos modificados. Cambiar el proyecto
        <strong>mueve la observación</strong> a otro proyecto: sale de los listados del proyecto
        actual y entra en los del nuevo.
      </p>

      <h3>Marcar revisada</h3>
      <p>
        Reinicia el ciclo local de revisión de esa observación, que pasa a vencer seis meses después.
        La cola de <strong>Review</strong> solo muestra lo que tiene la fecha de revisión vencida,
        así que puede estar legítimamente vacía: la acción también está disponible en el detalle de
        la observación.
      </p>

      <h3>Eliminar</h3>
      <p>
        Es un <strong>borrado suave</strong>: la fila permanece en la base marcada como borrada y
        desaparece de todos los listados (recientes, búsqueda, review y export). Exige escribir el id
        exacto y <strong>no se puede deshacer</strong>, porque el runtime no tiene ningún endpoint de
        restauración. El borrado permanente no se ofrece a propósito.
      </p>

      <h3>Juzgar una relación de conflicto</h3>
      <p>
        El veredicto se escribe en la base y <strong>reemplaza</strong> el anterior: el runtime lo
        sobrescribe sin comprobar el estado previo, así que no se conserva el veredicto sustituido.
      </p>

      <h3>Descargar export</h3>
      <p>
        Solo lee del runtime. Es la copia de seguridad recomendada antes de borrar algo.
      </p>
    </section>

    <section id="limitaciones" class="help-section">
      <h2>Limitaciones conocidas</h2>
      <table class="checks">
        <thead>
          <tr>
            <th scope="col">Limitación del runtime</th>
            <th scope="col">Qué hace la aplicación al respecto</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              No hay detalle de sesión por HTTP: <code>/observations</code> y
              <code>/prompts/recent</code> ignoran <code>session_id</code>.
            </td>
            <td>
              La vista de Sesiones muestra solo los metadatos de la sesión y ofrece el rodeo de
              abrir Recientes filtrado por el proyecto de esa sesión.
            </td>
          </tr>
          <tr>
            <td>No hay paginación por offset en observaciones ni en prompts: solo <code>limit</code>.</td>
            <td>
              Recientes, Sesiones y Búsqueda ofrecen distintos tamaños de página; no hay páginas
              anteriores ni siguientes para esas listas.
            </td>
          </tr>
          <tr>
            <td>Solo <code>/search</code> acepta el filtro por tipo.</td>
            <td>
              En Recientes el filtro por tipo se aplica en el navegador sobre la página cargada, y la
              vista lo indica expresamente.
            </td>
          </tr>
          <tr>
            <td>
              Las relaciones de conflicto traen <code>sync_id</code> (<code>obs-…</code>) en lugar del
              id numérico que necesita <code>/observations/:id</code>.
            </td>
            <td>
              Las filas de Conflictos se muestran como texto, sin enlace; juzgar sí está disponible.
            </td>
          </tr>
          <tr>
            <td>
              <code>/stats?all_projects=true</code> solo devuelve nombres de proyectos, sin conteos, y
              omite los que no tienen observaciones.
            </td>
            <td>
              El Dashboard lista esos nombres y totales globales; los conteos por proyecto y los
              proyectos podables solo aparecen en Proyectos, que los lee por otra vía.
            </td>
          </tr>
          <tr>
            <td>El timeline exige un proyecto explícito y sus tramos vacíos pueden llegar como <code>null</code>.</td>
            <td>
              La vista resuelve el proyecto desde la observación focal, avisa cuando esa observación
              no tiene proyecto y trata los tramos <code>null</code> como listas vacías.
            </td>
          </tr>
          <tr>
            <td>
              No hay endpoints de gestión de proyectos por HTTP (listado, poda o fusión), ni
              configuración de setup de agentes, ni sincronización con la nube.
            </td>
            <td>
              Proyectos lee el inventario por MCP en <code>/local/projects</code> y copia los comandos
              de poda y consolidación; no los ejecuta. La configuración de agentes y la nube siguen en
              el CLI y la TUI.
            </td>
          </tr>
          <tr>
            <td>
              El API HTTP rechaza los nombres con ruta con <code>400 invalid_project</code> («project
              must be a name, not a path») en <code>/stats</code>, <code>/observations</code>,
              <code>/sessions/recent</code> y <code>/prompts/recent</code>.
            </td>
            <td>
              El inventario los marca como «nombre con ruta · no consultable por HTTP»; el resto de
              pantallas no puede consultarlos ni filtrar por ellos.
            </td>
          </tr>
          <tr>
            <td>
              <code>MergeProjects</code> falla a propósito si el nombre de origen no normaliza al
              canónico: <code>source project "…" must normalize to canonical project "…"</code>.
            </td>
            <td>
              Proyectos muestra <code>engram projects consolidate --all --dry-run</code> como autoridad
              y no propone fusiones; los nombres con ruta se resuelven moviendo sus observaciones una a
              una y podando después el nombre que quede vacío.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="avisos" class="help-section">
      <h2>Avisos de lectura</h2>
      <p class="help-note help-note-warn">
        Esta aplicación escribe en tu memoria real: lo que guardes, edites, fijes, marques o juzgues
        afecta a la misma base que usan el CLI y los agentes. No hay papelera ni «deshacer» para el
        borrado, así que descarga el export antes de eliminar algo.
      </p>
      <p class="help-note">
        Si algo no aparece, comprueba primero que el runtime sigue escuchando en el puerto 7437: el
        chip de estado de la cabecera y el botón «Reintentar» muestran su respuesta.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
// The only dynamic part of this page: one read-only probe of the runtime it describes. Local refs
// on purpose, so the page does not depend on the shell's shared health poll having run.
import { onMounted, ref } from 'vue'
import { getHealth } from '../api/client'

const runtimeVersion = ref('')
const runtimeReachable = ref<boolean | null>(null)

onMounted(async () => {
  try {
    runtimeVersion.value = (await getHealth()).version
    runtimeReachable.value = true
  } catch {
    runtimeReachable.value = false
  }
})
</script>
