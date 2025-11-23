import http from 'node:http';
import postgres from 'postgres';

// Database connection
const sql = postgres({
  host: 'localhost',
  port: 5433,
  database: 'interdb',
  username: 'interuser',
  password: 'interpass',
});

// Test database connection
async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as now`;
    console.log('Database connected! Time:', result[0].now);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Helper to parse JSON body
async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Route handlers
const handlers: Record<string, (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>> = {
  // Health check
  '/readyz': async (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  },

  // GET all todos
  '/todos': async (req, res) => {
    if (req.method === 'GET') {
      const todos = await sql`
        SELECT t.*, u.email 
        FROM todos t
        JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC
      `;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(todos));
    }
    // POST new todo
    else if (req.method === 'POST') {
      const body = await parseBody(req);
      const { name, user_id } = body;

      if (!name || !user_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'name and user_id required' }));
        return;
      }

      const result = await sql`
        INSERT INTO todos (name, user_id)
        VALUES (${name}, ${user_id}::int)
        RETURNING *
      `;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result[0]));
    }
  },

  // GET/PUT/DELETE specific todo
  '/todos/': async (req, res) => {
    // Guard check for req.url
    if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid URL' }));
        return;
    }
    const id = req.url.split('/')[2]; // Extract ID from URL

    // GET single todo
    if (req.method === 'GET') {
      const todo = await sql`SELECT * FROM todos WHERE id = ${id}::int`;
      if (todo.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Todo not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(todo[0]));
    }
    // UPDATE todo
    else if (req.method === 'PUT') {
        const body = await parseBody(req);
        const { name, completed } = body;

        // Only update fields that are provided
        let result;

        if (name !== undefined && completed !== undefined) {
            // Both fields provided
            result = await sql`
            UPDATE todos 
            SET name = ${name}, completed = ${completed}, updated_at = NOW()
            WHERE id = ${id}::int
            RETURNING *
            `;
        } else if (name !== undefined) {
            // Only name provided
            result = await sql`
            UPDATE todos 
            SET name = ${name}, updated_at = NOW()
            WHERE id = ${id}::int
            RETURNING *
            `;
        } else if (completed !== undefined) {
            // Only completed provided
            result = await sql`
            UPDATE todos 
            SET completed = ${completed}, updated_at = NOW()
            WHERE id = ${id}::int
            RETURNING *
            `;
        } else {
            // Nothing to update
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No fields to update' }));
            return;
        }

        if (result.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Todo not found' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result[0]));
    }

    // DELETE todo
    else if (req.method === 'DELETE') {
      const result = await sql`
        DELETE FROM todos 
        WHERE id = ${id}::int
        RETURNING *
      `;

      if (result.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Todo not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Deleted', todo: result[0] }));
    }
  },
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Guard check for missing URL
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  console.log(`${req.method} ${req.url}`);

  // Find matching handler
  let handler = handlers[req.url];
  
  // Check for dynamic routes (like /todos/123)
  if (!handler && req.url.startsWith('/todos/')) {
    handler = handlers['/todos/'];
  }

  if (handler) {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start server
const PORT = 3000;
await testConnection();
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});