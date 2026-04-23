# Tickets Events

Entorno base para un sistema web de tickets para eventos.

## Incluye

- Node.js con Express
- PostgreSQL
- Landing con slider de eventos desde la base de datos
- Páginas separadas para inicio de sesión y registro
- Endpoint de salud en `/health`

## Arranque

1. Copia `.env.example` a `.env`
2. Levanta PostgreSQL con Docker:
   ```bash
   docker compose up -d
   ```
   Si ya tenías el volumen creado y cambiaste `schema.sql` o `seed.sql`,
   ejecuta antes:
   ```bash
   docker compose down -v
   ```
3. Instala dependencias:
   ```bash
   npm install
   ```
4. Carga los eventos de prueba:
   ```bash
   npm run seed
   ```
5. Inicia la app:
   ```bash
   npm run dev
   ```

## Subdominios locales

La app distingue estas entradas por hostname:

- `tickets.local` o `localhost`: bienvenida con slider
- `login.tickets.local`: inicio de sesión
- `register.tickets.local`: registro

Si quieres usarlos en local, agrega estas líneas al archivo `hosts`:

```text
127.0.0.1 tickets.local
127.0.0.1 login.tickets.local
127.0.0.1 register.tickets.local
```

## Admin y errores

- `GET /admin`: listado estatico de eventos para administracion.
- `GET /admin/create`: formulario estatico para preparar un alta de evento.
- `GET /error`: pagina de error personalizable por querystring.
- Si queres devolver un error custom desde una ruta, podes usar `res.send(renderErrorPage({...}))`.

## Sesiones

- El login guarda `req.session.user` en el servidor.
- La home consulta `/api/session` para mostrar el usuario autenticado.
- `POST /logout` destruye la sesión y limpia la cookie.
- En desarrollo podés usar cualquier `SESSION_SECRET` en `.env`; en producción conviene una cadena larga y privada.

## Estructura

- `server.js`: servidor principal
- `src/db.js`: pool de PostgreSQL
- `public/`: páginas públicas y slider
- `sql/schema.sql`: esquema inicial
- `sql/seed.sql`: seed para Docker
- `scripts/seed.js`: seed manual para Node
