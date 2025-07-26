#!/bin/bash

# Setup script for MCP servers
# This script helps configure Claude Desktop with the necessary MCP servers

echo "🚀 Setting up MCP servers for Financial Data Puncher"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install MCP server packages
echo "📦 Installing MCP server packages..."
npm run mcp:install

if [ $? -eq 0 ]; then
    echo "✅ MCP server packages installed successfully"
else
    echo "❌ Failed to install MCP server packages"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your actual API keys"
else
    echo "✅ .env file found"
fi

# Determine Claude Desktop config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CLAUDE_CONFIG_PATH="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
    CLAUDE_CONFIG_PATH="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
else
    echo "❌ Unsupported operating system: $OSTYPE"
    exit 1
fi

echo "🔍 Claude Desktop config path: $CLAUDE_CONFIG_PATH"

# Create Claude config directory if it doesn't exist
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo "📁 Creating Claude config directory..."
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Check if Claude Desktop config exists
if [ -f "$CLAUDE_CONFIG_PATH" ]; then
    echo "⚠️  Claude Desktop config already exists at:"
    echo "   $CLAUDE_CONFIG_PATH"
    echo "   Please manually merge the MCP server configuration."
    echo "   See MCP_SETUP.md for details."
else
    echo "📝 Creating Claude Desktop config from template..."
    cp claude_desktop_config.template.json "$CLAUDE_CONFIG_PATH"
    echo "✅ Template copied to: $CLAUDE_CONFIG_PATH"
    echo "🔧 Please edit the config file and replace placeholder values with your actual API keys"
fi

echo ""
echo "🎉 MCP setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit your .env file with actual API keys"
echo "2. Edit Claude Desktop config with your credentials:"
echo "   $CLAUDE_CONFIG_PATH"
echo "3. Restart Claude Desktop"
echo "4. Test MCP servers with: npm run mcp:llamaparse"
echo ""
echo "📚 For detailed instructions, see MCP_SETUP.md"