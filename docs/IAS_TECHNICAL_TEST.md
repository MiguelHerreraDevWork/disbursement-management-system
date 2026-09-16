# Prueba técnica Full Stack - Node.js + React 18+

Candidato externo | Tiempo objetivo: 2 a 3 horas máximo

## 1. Objetivo del reto

Construir una solución Full Stack pequeña pero completa que permita registrar, consultar y decidir solicitudes de desembolso a proveedores. El ejercicio busca evidenciar cómo analizas restricciones, modelas datos, diseñas contratos, implementas el flujo de usuario, proteges la solución y dejas trazabilidad suficiente para operarla y evolucionarla.

> El alcance está diseñado para 2 a 3 horas. Se valora más una solución funcional, coherente y defendible que una implementación sobredimensionada. Documenta con claridad lo que dejes fuera por tiempo.

## 2. Contexto de negocio

Una compañía procesa pagos a proveedores por servicios ya ejecutados. Antes de enviar un desembolso al sistema financiero, un analista registra una solicitud y un supervisor la aprueba o rechaza. En producción han aparecido solicitudes duplicadas por reintentos del cliente y decisiones concurrentes de dos supervisores sobre la misma solicitud. El equipo también necesita entender rápidamente qué ocurrió cuando una operación falla.

La nueva herramienta debe reducir esos errores sin frenar la operación. Los datos de concepto y observaciones provienen de usuarios y deben considerarse entrada no confiable.

## 3. Modelo mínimo de negocio

| Entidad | Campos mínimos | Notas |
|---|---|---|
| Proveedor | id, taxId, name | taxId debe permitir identificar al proveedor. |
| Solicitud de desembolso | id, externalReference, supplierId, amount, currency, concept, status, createdAt, updatedAt | status: PENDING, APPROVED o REJECTED. |
| Decisión | requestId, decision, reason, decidedBy, decidedAt | La razón es obligatoria al rechazar. |

Puedes ajustar el modelo si lo justificas. No se evalúa que reproduzcas exactamente estos nombres, sino que conserves las reglas del negocio y la integridad de la información.

## 4. Requisitos funcionales

1. Registrar una solicitud de desembolso asociada a un proveedor, con referencia externa, monto, moneda y concepto.
2. Listar solicitudes con al menos filtro por estado y búsqueda por proveedor o referencia. El listado debe contemplar un volumen creciente de registros sin cargar innecesariamente todo el histórico.
3. Consultar el detalle de una solicitud.
4. Aprobar o rechazar una solicitud pendiente. Una solicitud ya decidida no puede cambiar de decisión. El rechazo exige una razón.
5. Si el cliente reintenta el registro de la misma operación por un timeout o error de red, la solución no debe crear dos desembolsos equivalentes.
6. Si dos supervisores intentan decidir la misma solicitud prácticamente al mismo tiempo, el resultado persistido debe ser consistente y auditable.
7. Los cambios de estado realizados desde otra sesión deben reflejarse en el frontend sin recargar completamente la aplicación y dentro de un máximo aproximado de 10 segundos.
8. El frontend debe permitir navegar entre el listado y el detalle mediante rutas explícitas; después de crear o decidir una solicitud, la información visible debe quedar sincronizada con el backend.

## 5. Requisito deliberadamente abierto

> Negocio indica que una solicitud "duplicada" corresponde a la misma operación, pero no define formalmente cuál combinación de campos identifica una operación. No inventes silenciosamente: deja documentada la pregunta, la suposición que adoptaste para completar el ejercicio y el riesgo de esa decisión.

## 6. Tecnologías y restricciones obligatorias

- **Backend:** Node.js. El framework es de libre elección; documenta versión y decisión.
- **Frontend:** React 18 o superior.
- **Persistencia:** base de datos relacional y un ORM. El motor y ORM son de libre elección.
- **Routing y data fetching:** deben ser explícitos en el frontend; incluye estados de carga, error y actualización posterior a mutaciones.
- **Git:** entrega mediante repositorio con historial de commits comprensible.
- **Docker:** la solución debe poder ejecutarse de forma reproducible mediante contenedores; incluye instrucciones claras.
- **Kubernetes:** incluye manifiestos mínimos o equivalente para desplegar la aplicación. No se exige disponer de un clúster ni realizar un despliegue real.
- **Comunicación:** define el contrato y el mecanismo de comunicación apropiados para las operaciones principales y para la actualización de estado indicada en RF7. Explica por qué escogiste ese enfoque frente a al menos una alternativa.

## 7. Seguridad obligatoria

Las operaciones protegidas deben exigir una identidad verificable y aplicar controles de acceso en el backend. Decide cómo resolver la autenticación para este ejercicio y documenta las validaciones que realiza el servidor. Si tu enfoque depende de un servicio externo, puedes sustituirlo por una alternativa local o controlada siempre que el comportamiento relevante sea verificable.

- Diferencia al menos dos capacidades de acceso: consulta/registro y decisión de aprobación o rechazo.
- No confíes únicamente en información enviada por el frontend para determinar identidad o permisos. Documenta qué atributos o evidencias verificas en el servidor y cómo evitas que un cliente pueda atribuirse capacidades que no posee.
- No expongas secretos, credenciales ni material de autenticación en código, logs o historial Git.
- Trata concept, reason y cualquier otro dato originado por usuarios como entrada no confiable. Su contenido no debe poder ejecutarse ni alterar el comportamiento de la interfaz al visualizarse.
- Los filtros, búsquedas y demás entradas del usuario no deben poder alterar la semántica de las operaciones de persistencia ni provocar la ejecución de instrucciones no previstas.
- Los mensajes de error no deben filtrar stack traces, credenciales ni detalles internos innecesarios al cliente.

## 8. Monitoreo y observabilidad

- Genera logs útiles para diagnosticar una solicitud: identificador/correlación, operación, resultado, respuesta y duración, sin registrar material de autenticación ni datos sensibles innecesarios.
- Expón una verificación de salud útil para ejecución en contenedores y Kubernetes. Distingue, si tu solución lo amerita, disponibilidad del proceso y capacidad real de atender tráfico.
- Implementa al menos una señal adicional a los logs (por ejemplo métrica o traza) que ayude a detectar errores o latencia. Puede ser simple, pero debe poder explicarse y probarse.
- Conecta las verificaciones de salud con los probes definidos en Kubernetes y documenta qué condición representa cada uno.

## 9. Docker y Kubernetes

- Incluye Dockerfile(s) y una forma simple de iniciar localmente los componentes requeridos, incluyendo la base de datos.
- Los manifiestos Kubernetes deben cubrir como mínimo la aplicación, Service, configuración externa, referencia segura a secretos, probes y recursos de ejecución razonables.
- No es obligatorio publicar imágenes ni desplegar en un clúster. Se evaluará la coherencia y la capacidad de explicar las decisiones.

## 10. Pruebas automatizadas

Incluye pruebas automatizadas relevantes para el riesgo del reto. Como mínimo, demuestra con pruebas uno de los comportamientos críticos del backend (por ejemplo transición de estado, reintento/duplicado o concurrencia) y un comportamiento importante del frontend relacionado con obtención/actualización de datos o autorización. No se exige un porcentaje fijo de cobertura.

## 11. Uso de Inteligencia Artificial

Puedes utilizar asistentes de IA. Se evaluará tu criterio y validación, no la cantidad de contenido generado. En la documentación de entrega incluye una bitácora breve que indique: herramienta usada, objetivo, un ejemplo de resultado que aceptaste/corregiste/rechazaste, cómo verificaste seguridad y corrección, y cómo evitaste compartir información sensible. Si decides no usar IA en alguna parte, puedes justificarlo.

## 12. Decisiones técnicas que debes dejar trazables

- Cómo definiste la identidad de una operación y evitas duplicados ante reintentos.
- Cómo mantienes una decisión consistente ante dos solicitudes concurrentes.
- Modelo relacional, relaciones, restricciones e índices relevantes.
- Contrato principal de comunicación y manejo de errores.
- Mecanismo de actualización del estado en el frontend y protocolo elegido frente a alternativas.
- Estrategia de routing, obtención de datos, caché/actualización y estados de UI.
- Estrategia de autenticación/autorización y controles aplicados a entradas no confiables, visualización de datos y acceso a persistencia.
- Qué observas mediante logs, salud y la señal adicional elegida.
- Qué dejaste fuera por el límite de tiempo, riesgos resultantes y qué harías después.

Puedes registrar estas decisiones en README, ADRs o el formato que prefieras. No se impone un nombre de archivo.

## 13. Reglas de entrega

- Repositorio Git accesible para evaluación, indicando rama y commit exacto de entrega.
- README con prerrequisitos, variables de entorno esperadas, pasos de ejecución, pruebas y rutas principales.
- Código fuente de backend y frontend, migraciones/esquema, configuración Docker y artefactos Kubernetes.
- Ejemplo de variables de entorno sin secretos reales.
- Registro de decisiones técnicas y bitácora de IA.
- Si algo no quedó implementado, identifícalo explícitamente y deja el enfoque propuesto; no ocultes fallos conocidos.

## 14. Criterios visibles de completitud

| Área | Se considera completa cuando... |
|---|---|
| Flujo funcional | Se puede registrar, listar, ver detalle y decidir una solicitud respetando las reglas principales. |
| Backend y datos | Existe persistencia relacional mediante ORM, validación y consistencia básica. |
| Frontend | Hay rutas diferenciadas, estados de carga/error y actualización tras mutaciones/cambios. |
| Seguridad | Las operaciones protegidas validan identidad y permisos en el servidor, y los controles sobre entradas no confiables, persistencia y secretos están atendidos. |
| Operación | La solución corre con Docker, incluye artefactos Kubernetes y señales de observabilidad. |
| Calidad | Existen pruebas automatizadas significativas y el repositorio deja trazabilidad técnica. |
