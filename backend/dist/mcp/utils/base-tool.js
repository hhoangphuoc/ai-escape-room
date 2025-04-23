"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
class BaseTool {
    // Execute the tool with the given arguments
    register(server) {
        server.tool(this.name, this.description, this.schema.shape, this.execute.bind(this));
    }
}
exports.BaseTool = BaseTool;
//# sourceMappingURL=base-tool.js.map