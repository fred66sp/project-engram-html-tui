<!--
  Static help page: no data fetching and no interactivity on purpose. Every claim below is
  checkable against the code or against the feature documents in odd/tasks/.
-->
<template>
  <div class="help">
    <h1>Ayuda</h1>

    <nav class="help-toc" aria-label="Contenido de la ayuda">
      <strong>Contenido</strong>
      <ul>
        <li><a href="#que-es">Qué es esta aplicación</a></li>
        <li><a href="#conexion">Cómo se conecta</a></li>
        <li><a href="#arranque">Cómo arrancarla</a></li>
        <li><a href="#pantallas">Las pantallas</a></li>
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
        </tbody>
      </table>
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
            <td><code>/stats</code> no expone contadores por proyecto.</td>
            <td>El Dashboard solo lista nombres de proyectos; los totales son globales.</td>
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
              La gestión de proyectos (prune/consolidate), la configuración de setup de agentes y la
              sincronización con la nube no están disponibles por HTTP.
            </td>
            <td>Siguen en el CLI y la TUI; la interfaz no las simula.</td>
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
