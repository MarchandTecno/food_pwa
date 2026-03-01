import 'dotenv/config';
import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs, resolvers } from './schema';
import { createContext } from './context';
import { validateRuntimeConfig } from './config/env';
import { buildCorsOptions, buildCspDirectives, graphqlRateLimitMiddleware } from './config/security';
import { requestIdMiddleware } from './middleware/requestId';
import { createGraphqlObservabilityPlugin } from './middleware/graphqlObservability';
import { getMetricsSnapshot } from './utils/metrics';
import { applyDatabaseErrorPolicy, prisma } from './database';

async function start() {
  validateRuntimeConfig();

  const app = express();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDevelopment = nodeEnv !== 'production';
  const graphqlPlayground = process.env.GRAPHQL_PLAYGROUND === 'true';
  const introspectionEnabled = isDevelopment || graphqlPlayground;
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: buildCspDirectives(),
    },
  }));
  
  app.use(cors(buildCorsOptions()));
  app.use(requestIdMiddleware);
  app.use(json());

  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    introspection: introspectionEnabled,
    plugins: [createGraphqlObservabilityPlugin()],
    formatError: applyDatabaseErrorPolicy,
  } as any);
  await server.start();

  app.use('/graphql', graphqlRateLimitMiddleware, expressMiddleware(server, { 
    context: async (ctx) => createContext(ctx.req, ctx.res) 
  }));

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        db: 'up',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'degraded',
        db: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/metrics', (_req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      graphql: getMetricsSnapshot(),
    });
  });

  const simpleEndpointItem = isDevelopment
    ? '<li><strong>Simple Query:</strong> POST to <code>/graphql-simple</code></li>'
    : '';
  const simpleQuerySection = isDevelopment
    ? `
          <div class="section">
            <h2>Test Query (POST to /graphql-simple)</h2>
            <pre>{
  "query": "{ __typename }"
}</pre>
          </div>`
    : '';

  if (isDevelopment) {
    app.post('/graphql-simple', express.json(), async (req, res) => {
      const { query, variables } = req.body;
      try {
        const result = await server.executeOperation({ query, variables });
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  // Welcome page with instructions
  app.get('/', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FoodFlow GraphQL Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #4CAF50; }
          code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
          a { color: #4CAF50; text-decoration: none; }
          a:hover { text-decoration: underline; }
          pre { background: #f0f0f0; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 FoodFlow GraphQL Server</h1>
          <p>Server is running and ready to accept GraphQL queries!</p>
          
          <div class="section">
            <h2>Endpoints</h2>
            <ul>
              <li><strong>GraphQL:</strong> <a href="/graphql">/graphql</a> (Apollo Sandbox)</li>
              <li><strong>Health Check:</strong> <a href="/health">/health</a></li>
              ${simpleEndpointItem}
            </ul>
          </div>

          ${simpleQuerySection}

          <div class="section">
            <h2>Authentication</h2>
            <p>Protected endpoints require a JWT token in the header:</p>
            <pre>Authorization: Bearer &lt;your_token&gt;</pre>
          </div>

          <div class="section">
            <h2>Documentation</h2>
            <ul>
              <li><a href="./GRAPHQL_API.md">GraphQL API Documentation</a></li>
              <li><a href="./README.md">Project README</a></li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  const port = process.env.PORT ?? 4000;
  app.listen(port, () => {
    console.log(`🚀 GraphQL server ready at http://localhost:${port}/graphql`);
    console.log(`📊 Health check at http://localhost:${port}/health`);
    console.log(`📄 Welcome page at http://localhost:${port}/`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
