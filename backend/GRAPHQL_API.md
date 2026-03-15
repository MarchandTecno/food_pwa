# FoodFlow GraphQL API Documentation

## Server Information

- **URL**: `http://localhost:4001/graphql`
- **Environment**: Development (Apollo Sandbox available)
- **Authentication**: JWT Bearer token in `Authorization` header

## Authentication

### Login
```graphql
mutation {
  login(email: "user@example.com", password: "password123") {
    token
    user {
      id
      email
      nombre
    }
  }
}
```

### Register
```graphql
mutation {
  register(email: "newuser@example.com", password: "password123", nombre: "John Doe") {
    token
    user {
      id
      email
      nombre
    }
  }
}
```

### Get Current User
```graphql
query {
  me {
    id
    email
    nombre
  }
}
```

**Required**: Authorization header with Bearer token
```
Authorization: Bearer <token>
```

---

## Products API

### Get All Products
```graphql
query {
  products(limit: 10) {
    id
    nombre
    descripcion
    precio_venta
    imagen_url
    is_available
  }
}
```

### Get Single Product
```graphql
query {
  product(id: "product-uuid") {
    id
    nombre
    descripcion
    precio_venta
    imagen_url
    is_available
  }
}
```

### Create Product
```graphql
mutation {
  createProduct(
    nombre: "Pizza Margherita"
    descripcion: "Fresh pizza with mozzarella"
    precio_venta: 12.50
    imagen_url: "https://example.com/pizza.jpg"
  ) {
    id
    nombre
    precio_venta
    is_available
  }
}
```

**Required**: Authorization header with Bearer token

### Update Product
```graphql
mutation {
  updateProduct(
    id: "product-uuid"
    nombre: "Pizza Margherita Premium"
    precio_venta: 15.00
    is_available: true
  ) {
    id
    nombre
    precio_venta
  }
}
```

**Required**: Authorization header with Bearer token

### Delete Product
```graphql
mutation {
  deleteProduct(id: "product-uuid")
}
```

**Required**: Authorization header with Bearer token

---

## Orders API

### Get All Orders
```graphql
query {
  orders(limit: 20) {
    id
    customer_name
    customer_whatsapp
    status
    subtotal
    total_neto
    created_at
    users {
      id
      email
      nombre
    }
    order_items {
      id
      cantidad
      precio_unitario_snapshot
      subtotal_item
      product {
        id
        nombre
        precio_venta
      }
    }
  }
}
```

**Required**: Authorization header with Bearer token

### Get Single Order
```graphql
query {
  order(id: "order-uuid") {
    id
    customer_name
    customer_whatsapp
    status
    subtotal
    total_neto
    created_at
    users {
      email
    }
    order_items {
      id
      product {
        nombre
        precio_venta
      }
      cantidad
      subtotal_item
    }
  }
}
```

**Required**: Authorization header with Bearer token

### Create Order
```graphql
mutation {
  createOrder(
    customer_name: "Juan Pérez"
    customer_whatsapp: "+569 91234567"
    items: [
      { product_id: "product-uuid-1", cantidad: 2 }
      { product_id: "product-uuid-2", cantidad: 1 }
    ]
  ) {
    id
    customer_name
    status
    subtotal
    total_neto
    created_at
    order_items {
      id
      cantidad
      subtotal_item
      product {
        nombre
        precio_venta
      }
    }
  }
}
```

**Required**: Authorization header with Bearer token

### Update Order Status
```graphql
mutation {
  updateOrderStatus(
    id: "order-uuid"
    status: "COMPLETADO"
  ) {
    id
    status
    updated_at
  }
}
```

Status valid values: `PENDIENTE`, `CONFIRMADO`, `EN_PREPARACION`, `COMPLETADO`, `CANCELADO`

**Required**: Authorization header with Bearer token

### Delete Order
```graphql
mutation {
  deleteOrder(id: "order-uuid")
}
```

**Required**: Authorization header with Bearer token

---

## Tenants API (Multi-tenant)

### Get All Tenants
```graphql
query {
  tenants(limit: 10) {
    id
    nombre
    email
    whatsapp
    created_at
  }
}
```

**Required**: Authorization header with Bearer token

### Get Single Tenant
```graphql
query {
  tenant(id: "tenant-uuid") {
    id
    nombre
    email
    whatsapp
    created_at
  }
}
```

**Required**: Authorization header with Bearer token

---

## Error Handling

### Authentication Error
```json
{
  "errors": [
    {
      "message": "Not authenticated",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

### Validation Error
```json
{
  "errors": [
    {
      "message": "User already exists",
      "extensions": {
        "code": "BAD_REQUEST"
      }
    }
  ]
}
```

---

## Testing with Apollo Sandbox

Access the Apollo Sandbox at: `http://localhost:4001/graphql`

### Steps:
1. Open the GraphQL endpoint in your browser
2. Use the `login` or `register` mutation to get a token
3. Go to **Headers** tab (⚙️ icon)
4. Add header:
   ```
   Authorization: Bearer <your_token>
   ```
5. Execute queries and mutations

---

## Rate Limiting

Current protections:
- Always-on for `login/register`.
- Always-on for admin credential mutations (`adminCreateUser`, `adminResetUserPassword`).
- Optional for broader sensitive mutations when `ENABLE_SENSITIVE_MUTATION_RATE_LIMIT=true`.

---

## Future Enhancements

- [ ] Subscription support (real-time order updates)
- [ ] Batch product import/export
- [ ] Advanced filtering and search
- [ ] File upload for product images
- [ ] Payment gateway integration
- [ ] Inventory management endpoints
- [ ] Analytics and reporting endpoints
