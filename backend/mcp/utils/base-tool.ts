import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";

export abstract class BaseTool {
    abstract name: string;
    abstract description: string;
    abstract schema: z.ZodObject<any>;

    // Execute the tool with the given arguments
    register(server: McpServer) {
        server.tool(
            this.name, 
            this.description, 
            this.schema.shape, 
            this.execute.bind(this)
        );
    }

    // Abstract method to be implemented by subclasses
    abstract execute(args: z.infer<typeof this.schema>): Promise<CallToolResult>;
}
