# Controllers (REST)

Esta carpeta está reservada para una fase futura de API REST.

Estado actual:
- El backend opera con GraphQL como única capa de entrada.
- No hay controladores REST activos en runtime.
- La lógica de negocio vive en `services` y acceso a datos en `database`.

Si se activa REST en el futuro:
- Los controladores deben delegar a `services`.
- No duplicar validaciones ni reglas de negocio.
- Reutilizar política de errores y helpers de `database`.
