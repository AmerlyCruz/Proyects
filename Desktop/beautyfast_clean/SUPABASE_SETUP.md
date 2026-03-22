# Supabase Setup

## 1. Crea el proyecto
- Abre Supabase y crea un proyecto nuevo.
- En `Project Settings > API`, copia:
  - `Project URL`
  - `anon public key`

## 2. Configura el frontend
- Abre [supabase-config.js](/c:/Users/UserGPC/Desktop/beautyfast_clean/Desktop/beautyfast_clean/supabase-config.js)
- Completa:
  - `url`
  - `anonKey`

## 3. Crea la tabla de pedidos
- En `SQL Editor`, ejecuta el contenido de [supabase-orders.sql](/c:/Users/UserGPC/Desktop/beautyfast_clean/Desktop/beautyfast_clean/supabase-orders.sql)

## 4. Activa Auth
- En `Authentication > Providers`, deja activo `Email`.
- Si quieres registro inmediato, desactiva temporalmente `Confirm email`.

## 5. Flujo que queda implementado
- [orders.html](/c:/Users/UserGPC/Desktop/beautyfast_clean/Desktop/beautyfast_clean/orders.html): registro, login y lista de pedidos del cliente.
- [checkout.html](/c:/Users/UserGPC/Desktop/beautyfast_clean/Desktop/beautyfast_clean/checkout.html): guarda pedidos en Supabase cuando el cliente ha iniciado sesión.

## 6. Comportamiento actual
- Si el cliente inicia sesión, su pedido se guarda en Supabase y luego lo ve en `Mis pedidos`.
- Si no ha iniciado sesión, el checkout sigue funcionando, pero el pedido no entra al historial.

## 7. Siguiente mejora recomendada
- Añadir estados internos del pedido: `pending_payment`, `paid`, `preparing`, `ready_for_pickup`, `out_for_delivery`, `completed`.
