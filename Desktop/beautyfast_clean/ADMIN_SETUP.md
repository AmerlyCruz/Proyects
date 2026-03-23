# Admin Setup

## 1. Ejecuta el SQL

1. Ejecuta primero `supabase-orders.sql` si todavía no lo corriste.
2. Ejecuta después `supabase-admin.sql` para crear:
   - `user_profiles`
   - `products`
   - `site_settings`
   - bucket público `product-images`
   - políticas admin para pedidos y productos

3. Si ya habías ejecutado `supabase-admin.sql` antes de este cambio, vuelve a correrlo para crear `site_settings` y sus políticas.

## 2. Crea o identifica tu cuenta admin real

1. Necesitas una cuenta real en Supabase Auth porque Supabase no permite login sólo con usuario local sin correo por debajo.
2. Si quieres que el panel se vea como `usuario + contraseña`, usa la cuenta interna definida en `supabase-config.js` dentro de `adminLogin.email`.
3. Crea esa cuenta desde `orders.html` o desde Supabase Auth.
4. En Supabase SQL Editor, promueve esa cuenta a admin:

```sql
update public.user_profiles
set role = 'admin'
where email = 'admin@elsecretodearis.local';
```

## 3. Abre el panel

1. Ve a `admin.html`.
2. Inicia sesión con el usuario fijo configurado en `supabase-config.js`:
   - usuario: `admin`
   - contraseña: la de la cuenta `admin@elsecretodearis.local`
3. Desde ahí podrás:
   - ver estadísticas básicas
   - crear productos
   - editar precios y ofertas
   - cambiar descripción
   - subir imágenes o usar URL pública
   - ocultar o destacar productos
   - importar el catálogo base al panel
   - cargar lotes de productos por JSON

## 4. Cómo funciona el catálogo público

1. `beautyfast.html` intentará leer productos desde Supabase.
2. Si la tabla `products` no existe o está vacía, la tienda sigue usando el catálogo fallback del frontend.
3. Usa el botón `Importar catálogo base` una vez para sembrar los productos históricos en Supabase.
4. Después de esa importación, el panel marca a Supabase como fuente oficial del storefront.
5. Desde ese momento, activar, desactivar, editar o borrar productos se respeta tal cual en la tienda pública.

## 5. Notas importantes

1. El panel admin está separado de la tienda pública para no romper el flujo actual.
2. Los pedidos siguen usando la tabla `orders` existente.
3. El panel muestra `usuario + contraseña`, pero internamente Supabase sigue autenticando con el correo configurado.
4. Si quieres estadísticas más avanzadas, el siguiente paso natural es agregar vistas SQL o RPCs para resumir ventas por día, top productos y ticket promedio.