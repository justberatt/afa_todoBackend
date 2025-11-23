## Quick Reference - Test All Endpoints:
```
# Health check
curl http://localhost:3000/readyz

# Get all todos
curl http://localhost:3000/todos

# Create a todo
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"name": "My new todo", "user_id": 1}'

# Update a todo
curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Get single todo
curl http://localhost:3000/todos/1

# Delete a todo
curl -X DELETE http://localhost:3000/todos/2
```