import "@std/dotenv/load";
import { AnthropicModelProvider, createZypherContext, ZypherAgent} from "@corespeed/zypher";
// import { runAgentInTerminal } from "@corespeed/zypher";
import { eachValueFrom } from "rxjs-for-await";

// Helper function to safely get environment variables
function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

// Initialize the agent execution context
const zypherContext = await createZypherContext(Deno.cwd());

// Create the agent with your preferred LLM provider
const agent = new ZypherAgent(
  zypherContext,
  new AnthropicModelProvider({
    apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
  }),
);

// Register and connect to an MCP server to give the agent web crawling capabilities
await agent.mcp.registerServer({
  id: "firecrawl",
  type: "command",
  command: {
    command: "npx",
    args: ["-y", "firecrawl-mcp"],
    env: {
      FIRECRAWL_API_KEY: getRequiredEnv("FIRECRAWL_API_KEY"),
    },
  },
});
// await agent.mcp.registerServer({
//   id: "fetch",
//   type: "command",
//   command: {
//     command: "npx",
//     args: ["-y", "@modelcontextprotocol/server-fetch"],
//   },
// });

// // Run a task - the agent will use web crawling to find current AI news
// const event$ = agent.runTask(
//   "What are the pros and cons of JavaScript?",
//   "claude-sonnet-4-20250514",
// );

// // Stream the results in real-time
// for await (const event of eachValueFrom(event$)) {
//   console.log(event);
// }

// Start interactive CLI instead of runTask
// await runAgentInTerminal(agent, "claude-sonnet-4-20250514");

// I need to start HTTP server to send the output from the agent to the frontend
// use Deno's standard HTTP server

Deno.serve({port: 8000}, async (req) => {
  const url = new URL(req.url); // parse the request URL

  // enable CORS for all origins
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders});
  }

  // serve the static files
  // [1] HTML file
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlFile = await Deno.readTextFile('../frontend/index.html');
    return new Response(htmlFile, {
      headers: {
        ...corsHeaders,
        "Content-Type": 'text/html',
      },
    });
  }

  // [2] CSS file
  if (url.pathname === '/style.css') {
    const cssFile = await Deno.readTextFile('../frontend/style.css');
    return new Response(cssFile, {
      headers: {
        ...corsHeaders,
        "Content-Type": 'text/css',
      },
    });
  }

  // [3] JS file
  if (url.pathname === '/script.js') {
    const jsFile = await Deno.readTextFile('../frontend/script.js');
    return new Response(jsFile, {
      headers: {
        ...corsHeaders,
        "Content-Type": 'application/javascript',
      }
    });
  }
  
  // Chat endpoint -> handle chat messages from the frontend
  if (url.pathname === '/chat' && req.method === 'POST') {
    try {
      const { message } = await req.json(); 

      // create the server-sent events (SSE) stream
      const stream = new ReadableStream({
        async start(controller) {

          const encoder = new TextEncoder();
          
          try {
            // run the agent task
            const event$ = agent.runTask(
                  `
                SYSTEM INSTRUCTIONS:
                You MUST follow the Firecrawl MCP tool schema exactly.

                When calling "firecrawl_search":
                - "sources" MUST be an array of objects:
                    [{ "type": "web", "url": "https://example.com" }]
                - NEVER use:
                    "sources": "string"
                    "sources": ["string"]
                - If unsure what to put: use "sources": [].

                You must always follow JSON schemas strictly when invoking MCP tools.
                Return tables, structured markdown, and formatted content normally.

                USER MESSAGE:
                ${message}
                `,
                  "claude-sonnet-4-20250514",
            );

            for await (const event of eachValueFrom(event$)) {

              // send the event to the frontend in SSE format
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            console.error("Error in agent task:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorData = `data: ${JSON.stringify({ 
              type: "error", 
              content: errorMessage
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

   return new Response("Not Found", { 
    status: 404,
    headers: corsHeaders,
  });
})