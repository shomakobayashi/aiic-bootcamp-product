import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const app = new Hono();

// DynamoDB クライアント初期化
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || '';
const CARTS_TABLE = process.env.CARTS_TABLE_NAME || '';
const ORDERS_TABLE = process.env.ORDERS_TABLE_NAME || '';
const USERS_TABLE = process.env.USERS_TABLE_NAME || '';

// ========================================
// ヘルスチェック
// ========================================
app.get('/', (c) => {
  return c.json({
    message: 'EC Site API is running!',
    version: '1.0.0',
    endpoints: {
      products: '/products',
      carts: '/carts',
      orders: '/orders',
      users: '/users',
    }
  });
});

// ========================================
// 商品管理 (Products)
// ========================================

// 全商品取得
app.get('/products', async (c) => {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: PRODUCTS_TABLE,
      })
    );
    return c.json({ products: result.Items || [] });
  } catch (error) {
    console.error('Error fetching products:', error);
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// 商品詳細取得
app.get('/products/:productId', async (c) => {
  const productId = c.req.param('productId');
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId },
      })
    );

    if (!result.Item) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({ product: result.Item });
  } catch (error) {
    console.error('Error fetching product:', error);
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

// 商品作成
app.post('/products', async (c) => {
  try {
    const body = await c.req.json();
    const product = {
      productId: crypto.randomUUID(),
      name: body.name,
      description: body.description || '',
      price: body.price,
      stock: body.stock || 0,
      category: body.category || '',
      imageUrl: body.imageUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: PRODUCTS_TABLE,
        Item: product,
      })
    );

    return c.json({ product }, 201);
  } catch (error) {
    console.error('Error creating product:', error);
    return c.json({ error: 'Failed to create product' }, 500);
  }
});

// 商品更新
app.put('/products/:productId', async (c) => {
  const productId = c.req.param('productId');
  try {
    const body = await c.req.json();

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (body.name !== undefined) {
      updateExpression.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = body.name;
    }
    if (body.description !== undefined) {
      updateExpression.push('#description = :description');
      expressionAttributeNames['#description'] = 'description';
      expressionAttributeValues[':description'] = body.description;
    }
    if (body.price !== undefined) {
      updateExpression.push('#price = :price');
      expressionAttributeNames['#price'] = 'price';
      expressionAttributeValues[':price'] = body.price;
    }
    if (body.stock !== undefined) {
      updateExpression.push('#stock = :stock');
      expressionAttributeNames['#stock'] = 'stock';
      expressionAttributeValues[':stock'] = body.stock;
    }
    if (body.category !== undefined) {
      updateExpression.push('#category = :category');
      expressionAttributeNames['#category'] = 'category';
      expressionAttributeValues[':category'] = body.category;
    }
    if (body.imageUrl !== undefined) {
      updateExpression.push('#imageUrl = :imageUrl');
      expressionAttributeNames['#imageUrl'] = 'imageUrl';
      expressionAttributeValues[':imageUrl'] = body.imageUrl;
    }

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    return c.json({ message: 'Product updated successfully', productId });
  } catch (error) {
    console.error('Error updating product:', error);
    return c.json({ error: 'Failed to update product' }, 500);
  }
});

// 商品削除
app.delete('/products/:productId', async (c) => {
  const productId = c.req.param('productId');
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: PRODUCTS_TABLE,
        Key: { productId },
      })
    );

    return c.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return c.json({ error: 'Failed to delete product' }, 500);
  }
});

// ========================================
// カート管理 (Cart)
// ========================================

// ユーザーのカート取得
app.get('/carts/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: CARTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );

    return c.json({ cartItems: result.Items || [] });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return c.json({ error: 'Failed to fetch cart' }, 500);
  }
});

// カートに商品追加
app.post('/carts/:userId/items', async (c) => {
  const userId = c.req.param('userId');
  try {
    const body = await c.req.json();
    const cartItem = {
      userId,
      productId: body.productId,
      quantity: body.quantity || 1,
      addedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: CARTS_TABLE,
        Item: cartItem,
      })
    );

    return c.json({ cartItem }, 201);
  } catch (error) {
    console.error('Error adding to cart:', error);
    return c.json({ error: 'Failed to add to cart' }, 500);
  }
});

// カート内商品の数量更新
app.put('/carts/:userId/items/:productId', async (c) => {
  const userId = c.req.param('userId');
  const productId = c.req.param('productId');
  try {
    const body = await c.req.json();

    await docClient.send(
      new UpdateCommand({
        TableName: CARTS_TABLE,
        Key: { userId, productId },
        UpdateExpression: 'SET quantity = :quantity',
        ExpressionAttributeValues: {
          ':quantity': body.quantity,
        },
      })
    );

    return c.json({ message: 'Cart item updated successfully' });
  } catch (error) {
    console.error('Error updating cart item:', error);
    return c.json({ error: 'Failed to update cart item' }, 500);
  }
});

// カートから商品削除
app.delete('/carts/:userId/items/:productId', async (c) => {
  const userId = c.req.param('userId');
  const productId = c.req.param('productId');
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: CARTS_TABLE,
        Key: { userId, productId },
      })
    );

    return c.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    console.error('Error removing from cart:', error);
    return c.json({ error: 'Failed to remove from cart' }, 500);
  }
});

// カートをクリア
app.delete('/carts/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    // まずカート内の全アイテムを取得
    const result = await docClient.send(
      new QueryCommand({
        TableName: CARTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );

    // 各アイテムを削除
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        await docClient.send(
          new DeleteCommand({
            TableName: CARTS_TABLE,
            Key: { userId, productId: item.productId },
          })
        );
      }
    }

    return c.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return c.json({ error: 'Failed to clear cart' }, 500);
  }
});

// ========================================
// 注文管理 (Orders)
// ========================================

// ユーザーの注文履歴取得
app.get('/orders/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        IndexName: 'UserOrdersIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // 新しい順
      })
    );

    return c.json({ orders: result.Items || [] });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// 注文詳細取得
app.get('/orders/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId },
      })
    );

    if (!result.Item) {
      return c.json({ error: 'Order not found' }, 404);
    }

    return c.json({ order: result.Item });
  } catch (error) {
    console.error('Error fetching order:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

// 注文作成
app.post('/orders', async (c) => {
  try {
    const body = await c.req.json();
    const order = {
      orderId: crypto.randomUUID(),
      userId: body.userId,
      items: body.items, // [{ productId, quantity, price }]
      totalAmount: body.totalAmount,
      status: 'pending',
      shippingAddress: body.shippingAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: order,
      })
    );

    return c.json({ order }, 201);
  } catch (error) {
    console.error('Error creating order:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

// 注文ステータス更新
app.put('/orders/:orderId/status', async (c) => {
  const orderId = c.req.param('orderId');
  try {
    const body = await c.req.json();

    await docClient.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': body.status,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );

    return c.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    return c.json({ error: 'Failed to update order status' }, 500);
  }
});

// ========================================
// ユーザー管理 (Users)
// ========================================

// 全ユーザー取得
app.get('/users', async (c) => {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
      })
    );
    return c.json({ users: result.Items || [] });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// ユーザー詳細取得
app.get('/users/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      })
    );

    if (!result.Item) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: result.Item });
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// メールアドレスでユーザー検索
app.get('/users/email/:email', async (c) => {
  const email = c.req.param('email');
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: result.Items[0] });
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// ユーザー作成
app.post('/users', async (c) => {
  try {
    const body = await c.req.json();
    const user = {
      userId: crypto.randomUUID(),
      email: body.email,
      name: body.name,
      address: body.address || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: user,
      })
    );

    return c.json({ user }, 201);
  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// ユーザー情報更新
app.put('/users/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const body = await c.req.json();

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (body.name !== undefined) {
      updateExpression.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = body.name;
    }
    if (body.email !== undefined) {
      updateExpression.push('#email = :email');
      expressionAttributeNames['#email'] = 'email';
      expressionAttributeValues[':email'] = body.email;
    }
    if (body.address !== undefined) {
      updateExpression.push('#address = :address');
      expressionAttributeNames['#address'] = 'address';
      expressionAttributeValues[':address'] = body.address;
    }

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    return c.json({ message: 'User updated successfully', userId });
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// ユーザー削除
app.delete('/users/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      })
    );

    return c.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

export const handler = handle(app);
